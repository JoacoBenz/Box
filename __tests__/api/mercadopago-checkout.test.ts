import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const session = {
    userId: 1,
    tenantId: 4,
    roles: ['director'] as string[],
    nombre: 'Director Test',
    email: 'director@escuela.edu.ar',
    areaId: 1,
  };
  const preapprovalCreate = vi.fn();
  return {
    session,
    getServerSession: vi.fn().mockResolvedValue(session),
    isMpEnabled: vi.fn().mockReturnValue(true),
    getSubscriptionStatusFresh: vi.fn(),
    preapprovalCreate,
    getPreApproval: vi.fn(() => ({ create: preapprovalCreate })),
    prisma: {
      tenants: { findUnique: vi.fn() },
      planes: { findUnique: vi.fn() },
    },
  };
});

vi.mock('@/lib/auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
  tenantPrisma: vi.fn(() => mocks.prisma),
}));
vi.mock('@/lib/permissions', () => ({
  verificarRol: vi.fn().mockReturnValue(true),
  apiError: vi.fn(
    (code: string, msg: string, status: number) =>
      new Response(JSON.stringify({ error: { code, message: msg } }), { status }),
  ),
}));
vi.mock('@/lib/audit', () => ({ getClientIp: vi.fn(() => '1.2.3.4') }));
vi.mock('@/lib/tenant-override', () => ({
  getEffectiveTenantId: vi.fn(),
}));
vi.mock('@/lib/mercadopago', () => ({
  isMpEnabled: mocks.isMpEnabled,
  getPreApproval: mocks.getPreApproval,
}));
vi.mock('@/lib/subscription', () => ({
  getSubscriptionStatusFresh: mocks.getSubscriptionStatusFresh,
}));
vi.mock('@/lib/logger', () => ({ logApiError: vi.fn() }));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    MP_ACCESS_TOKEN: 'TEST-token',
    MP_PLAN_ID: 'plan_abc123',
    NEXTAUTH_URL: 'https://app.test',
  };
  vi.clearAllMocks();
  mocks.isMpEnabled.mockReturnValue(true);
  mocks.getServerSession.mockResolvedValue(mocks.session);
  mocks.prisma.tenants.findUnique.mockResolvedValue({
    nombre: 'Escuela Test',
    email_contacto: 'contacto@escuela.edu.ar',
  });
  mocks.prisma.planes.findUnique.mockResolvedValue({ precio_ars: 152000 });
  mocks.preapprovalCreate.mockResolvedValue({
    id: 'preapp_xyz',
    init_point: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=preapp_xyz',
  });
});

import { POST } from '@/app/api/mercadopago/checkout/route';

function makeRequest() {
  return new Request('http://localhost/api/mercadopago/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

describe('POST /api/mercadopago/checkout', () => {
  it('devuelve 503 cuando MP no está configurado', async () => {
    mocks.isMpEnabled.mockReturnValue(false);
    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error.code).toBe('MP_DISABLED');
  });

  it('devuelve 404 cuando el tenant no tiene suscripción', async () => {
    mocks.getSubscriptionStatusFresh.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe('NO_SUBSCRIPTION');
  });

  it('devuelve 400 cuando la suscripción ya está activa', async () => {
    mocks.getSubscriptionStatusFresh.mockResolvedValue({ estado: 'active' });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('ALREADY_ACTIVE');
  });

  it('crea preapproval con session.email como hint en producción', async () => {
    delete process.env.MP_TEST_BUYER_EMAIL;
    mocks.getSubscriptionStatusFresh.mockResolvedValue({ estado: 'trialing', planId: 1 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toBe(
      'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=preapp_xyz',
    );
    expect(mocks.preapprovalCreate).toHaveBeenCalledWith({
      body: expect.objectContaining({
        external_reference: '4',
        payer_email: 'director@escuela.edu.ar',
        status: 'pending',
        back_url: 'https://app.test/perfil?tab=facturacion&checkout=success',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: 152000,
          currency_id: 'ARS',
        },
      }),
    });
    // No pasamos preapproval_plan_id porque MP exige card_token_id en ese flow
    expect(mocks.preapprovalCreate.mock.calls[0][0].body.preapproval_plan_id).toBeUndefined();
  });

  it('MP_TEST_BUYER_EMAIL sobreescribe el email del pagador en sandbox', async () => {
    process.env.MP_TEST_BUYER_EMAIL = 'TESTUSER123@testuser.com';
    mocks.getSubscriptionStatusFresh.mockResolvedValue({ estado: 'trialing', planId: 1 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mocks.preapprovalCreate).toHaveBeenCalledWith({
      body: expect.objectContaining({ payer_email: 'TESTUSER123@testuser.com' }),
    });
  });

  it('cae a email_contacto del tenant si session.email no existe', async () => {
    delete process.env.MP_TEST_BUYER_EMAIL;
    mocks.getSubscriptionStatusFresh.mockResolvedValue({ estado: 'trialing', planId: 1 });
    mocks.getServerSession.mockResolvedValue({ ...mocks.session, email: null });
    mocks.prisma.tenants.findUnique.mockResolvedValue({
      nombre: 'Escuela Test',
      email_contacto: 'admin@escuela.edu.ar',
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mocks.preapprovalCreate).toHaveBeenCalledWith({
      body: expect.objectContaining({ payer_email: 'admin@escuela.edu.ar' }),
    });
  });

  it('400 NO_EMAIL si no hay ningún email disponible', async () => {
    delete process.env.MP_TEST_BUYER_EMAIL;
    mocks.getSubscriptionStatusFresh.mockResolvedValue({ estado: 'trialing', planId: 1 });
    mocks.getServerSession.mockResolvedValue({ ...mocks.session, email: null });
    mocks.prisma.tenants.findUnique.mockResolvedValue({
      nombre: 'Escuela Test',
      email_contacto: '',
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('NO_EMAIL');
  });

  it('expone detalle del error de MP cuando preapproval.create falla', async () => {
    process.env.MP_TEST_BUYER_EMAIL = 'TESTUSER123@testuser.com';
    mocks.getSubscriptionStatusFresh.mockResolvedValue({ estado: 'trialing', planId: 1 });
    mocks.preapprovalCreate.mockRejectedValueOnce({
      message: 'card_token_id is required',
      status: 400,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.detail).toBe('card_token_id is required');
    expect(json.error.mpStatus).toBe(400);
  });

  it('funciona para suscripciones canceladas (reactivación)', async () => {
    mocks.getSubscriptionStatusFresh.mockResolvedValue({ estado: 'canceled', planId: 1 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mocks.preapprovalCreate).toHaveBeenCalled();
  });

  it('funciona para suscripciones unpaid (reactivación)', async () => {
    mocks.getSubscriptionStatusFresh.mockResolvedValue({ estado: 'unpaid', planId: 1 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mocks.preapprovalCreate).toHaveBeenCalled();
  });

  it('devuelve 500 si el plan no se encuentra', async () => {
    mocks.getSubscriptionStatusFresh.mockResolvedValue({ estado: 'trialing', planId: 99 });
    mocks.prisma.planes.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe('NO_PLAN');
  });

  it('devuelve 500 si MP no devuelve init_point', async () => {
    mocks.getSubscriptionStatusFresh.mockResolvedValue({ estado: 'trialing', planId: 1 });
    mocks.preapprovalCreate.mockResolvedValueOnce({ id: 'x', init_point: undefined });
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});
