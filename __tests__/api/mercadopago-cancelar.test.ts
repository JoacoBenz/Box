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
  return {
    session,
    getServerSession: vi.fn().mockResolvedValue(session),
    isMpEnabled: vi.fn().mockReturnValue(true),
    preapproval: { update: vi.fn().mockResolvedValue({}) },
    getSubscriptionStatusFresh: vi.fn(),
    invalidateTenantCache: vi.fn(),
    prisma: {
      suscripciones: {
        update: vi.fn().mockResolvedValue({}),
      },
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
  getPreApproval: vi.fn(() => mocks.preapproval),
}));
vi.mock('@/lib/subscription', () => ({
  getSubscriptionStatusFresh: mocks.getSubscriptionStatusFresh,
}));
vi.mock('@/lib/cache', () => ({
  invalidateTenantCache: mocks.invalidateTenantCache,
}));
vi.mock('@/lib/logger', () => ({ logApiError: vi.fn() }));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, MP_ACCESS_TOKEN: 'TEST-token', MP_PLAN_ID: 'plan_abc123' };
  vi.clearAllMocks();
  mocks.isMpEnabled.mockReturnValue(true);
  mocks.getServerSession.mockResolvedValue(mocks.session);
});

import { POST } from '@/app/api/mercadopago/cancelar/route';

function makeRequest() {
  return new Request('http://localhost/api/mercadopago/cancelar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/mercadopago/cancelar', () => {
  it('devuelve 503 cuando MP no está configurado', async () => {
    mocks.isMpEnabled.mockReturnValue(false);
    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error.code).toBe('MP_DISABLED');
  });

  it('devuelve 400 cuando no hay preapproval activa', async () => {
    mocks.getSubscriptionStatusFresh.mockResolvedValue({
      estado: 'trialing',
      mpPreapprovalId: null,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('NO_PREAPPROVAL');
  });

  it('devuelve 400 cuando la suscripción ya está cancelada', async () => {
    mocks.getSubscriptionStatusFresh.mockResolvedValue({
      estado: 'canceled',
      mpPreapprovalId: 'preapp_123',
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('ALREADY_CANCELED');
  });

  it('cancela correctamente: actualiza MP + DB + invalida cache', async () => {
    mocks.getSubscriptionStatusFresh.mockResolvedValue({
      estado: 'active',
      mpPreapprovalId: 'preapp_456',
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    expect(mocks.preapproval.update).toHaveBeenCalledWith({
      id: 'preapp_456',
      body: { status: 'cancelled' },
    });
    expect(mocks.prisma.suscripciones.update).toHaveBeenCalledWith({
      where: { tenant_id: 4 },
      data: { estado: 'canceled', canceled_at: expect.any(Date) },
    });
    expect(mocks.invalidateTenantCache).toHaveBeenCalledWith(4);
  });

  it('devuelve 500 cuando MP falla al cancelar', async () => {
    mocks.getSubscriptionStatusFresh.mockResolvedValue({
      estado: 'active',
      mpPreapprovalId: 'preapp_789',
    });
    mocks.preapproval.update.mockRejectedValue(new Error('MP API timeout'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe('CANCEL_ERROR');
  });

  it('devuelve 400 cuando no hay suscripción', async () => {
    mocks.getSubscriptionStatusFresh.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('NO_PREAPPROVAL');
  });
});
