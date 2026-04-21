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
    getSubscriptionStatusFresh: vi.fn(),
    getPlanUsage: vi.fn(),
  };
});

vi.mock('@/lib/auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/prisma', () => ({
  prisma: {},
  tenantPrisma: vi.fn(() => ({})),
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
vi.mock('@/lib/subscription', () => ({
  getSubscriptionStatusFresh: mocks.getSubscriptionStatusFresh,
}));
vi.mock('@/lib/plan-limits', () => ({
  getPlanUsage: mocks.getPlanUsage,
}));
vi.mock('@/lib/logger', () => ({ logApiError: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getServerSession.mockResolvedValue(mocks.session);
});

import { GET } from '@/app/api/mercadopago/subscription/route';

function makeRequest() {
  return new Request('http://localhost/api/mercadopago/subscription', {
    method: 'GET',
  });
}

const mockUsage = {
  areas: { count: 2, limit: 3 },
  centros_costo: { count: 3, limit_per_area: 2, total_limit: 6 },
  roles: {
    director: { count: 1, limit: 1 },
    tesoreria: { count: 0, limit: 1 },
    admin: { count: 0, limit: 1 },
    compras: { count: 1, limit: 1 },
    responsable_area: { total: 1, limit_per_area: 1, areas_con_responsable: 1 },
  },
};

describe('GET /api/mercadopago/subscription', () => {
  it('devuelve 404 cuando no hay suscripción', async () => {
    mocks.getSubscriptionStatusFresh.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe('NO_SUBSCRIPTION');
  });

  it('devuelve subscription + usage para suscripción trialing', async () => {
    const sub = {
      tenantId: 4,
      planId: 1,
      planNombre: 'box-principal',
      estado: 'trialing',
      trialEndsAt: new Date('2026-05-20'),
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      mpPreapprovalId: null,
      mpPayerEmail: null,
      hasAccess: true,
      trialDaysLeft: 29,
    };
    mocks.getSubscriptionStatusFresh.mockResolvedValue(sub);
    mocks.getPlanUsage.mockResolvedValue(mockUsage);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.subscription.estado).toBe('trialing');
    expect(json.subscription.trialDaysLeft).toBe(29);
    expect(json.usage.areas.count).toBe(2);
    expect(json.usage.areas.limit).toBe(3);
  });

  it('devuelve subscription + usage para suscripción activa', async () => {
    const sub = {
      tenantId: 4,
      planId: 1,
      planNombre: 'box-principal',
      estado: 'active',
      trialEndsAt: null,
      currentPeriodEnd: new Date('2026-06-20'),
      cancelAtPeriodEnd: false,
      mpPreapprovalId: 'preapp_ok',
      mpPayerEmail: 'director@escuela.edu.ar',
      hasAccess: true,
      trialDaysLeft: null,
    };
    mocks.getSubscriptionStatusFresh.mockResolvedValue(sub);
    mocks.getPlanUsage.mockResolvedValue(mockUsage);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.subscription.estado).toBe('active');
    expect(json.subscription.mpPreapprovalId).toBe('preapp_ok');
    expect(json.usage.roles.director.count).toBe(1);
  });
});
