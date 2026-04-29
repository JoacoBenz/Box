import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    planes: { findUnique: vi.fn() },
    suscripciones: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
// Identity cache: la lógica del TTL está cubierta en cache.test.ts.
vi.mock('@/lib/cache', () => ({
  cached: <T>(_key: string, _ttl: number, fetcher: () => Promise<T>) => fetcher(),
  invalidateTenantCache: vi.fn(),
}));

import {
  createTrialSubscription,
  getSubscriptionStatus,
  getSubscriptionStatusFresh,
  mapMpPreapprovalStatus,
  markSubscriptionCanceled,
  syncSubscriptionFromMp,
  attachMpPreapprovalToTenant,
} from '@/lib/subscription';

const defaultPlan = {
  id: 1,
  nombre: 'box-principal',
  precio_ars: 110000,
  trial_dias: 14,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── createTrialSubscription ──

describe('createTrialSubscription', () => {
  it('crea un trial de 14 días atado al plan default', async () => {
    mocks.prisma.planes.findUnique.mockResolvedValue(defaultPlan);
    mocks.prisma.suscripciones.create.mockResolvedValue({ id: 10 });

    const before = Date.now();
    await createTrialSubscription(42);
    const after = Date.now();

    expect(mocks.prisma.suscripciones.create).toHaveBeenCalledOnce();
    const [{ data }] = mocks.prisma.suscripciones.create.mock.calls[0];
    expect(data.tenant_id).toBe(42);
    expect(data.plan_id).toBe(defaultPlan.id);
    expect(data.estado).toBe('trialing');
    const delta = data.trial_ends_at.getTime() - data.trial_starts_at.getTime();
    expect(delta).toBe(14 * 24 * 60 * 60 * 1000);
    expect(data.trial_starts_at.getTime()).toBeGreaterThanOrEqual(before);
    expect(data.trial_starts_at.getTime()).toBeLessThanOrEqual(after);
  });

  it('tira error claro cuando falta el plan default', async () => {
    mocks.prisma.planes.findUnique.mockResolvedValue(null);
    await expect(createTrialSubscription(42)).rejects.toThrow(/prisma db seed/i);
    expect(mocks.prisma.suscripciones.create).not.toHaveBeenCalled();
  });
});

// ── getSubscriptionStatus / Fresh ──

function subFixture(overrides: Record<string, unknown> = {}) {
  return {
    tenant_id: 42,
    plan_id: 1,
    estado: 'active',
    mp_preapproval_id: 'preapp_x',
    mp_payer_email: 'payer@x.com',
    trial_starts_at: null,
    trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    plan: defaultPlan,
    ...overrides,
  };
}

describe('getSubscriptionStatus', () => {
  it('devuelve null cuando el tenant no tiene suscripción', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(null);
    const snapshot = await getSubscriptionStatus(42);
    expect(snapshot).toBeNull();
  });

  it('permite acceso mientras el trial sigue vigente', async () => {
    const trialEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(
      subFixture({ estado: 'trialing', trial_ends_at: trialEnd }),
    );
    const snapshot = await getSubscriptionStatus(42);
    expect(snapshot?.hasAccess).toBe(true);
    expect(snapshot?.estado).toBe('trialing');
    expect(snapshot?.trialDaysLeft).toBe(5);
  });

  it('bloquea cuando el trial expiró', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(
      subFixture({ estado: 'trialing', trial_ends_at: new Date(Date.now() - 1000) }),
    );
    const snapshot = await getSubscriptionStatus(42);
    expect(snapshot?.hasAccess).toBe(false);
    expect(snapshot?.trialDaysLeft).toBe(0);
  });

  it('permite acceso para subs activas', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(subFixture({ estado: 'active' }));
    const snapshot = await getSubscriptionStatus(42);
    expect(snapshot?.hasAccess).toBe(true);
    expect(snapshot?.trialDaysLeft).toBeNull();
  });

  it('otorga 3 días de gracia en past_due', async () => {
    const periodEnd = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(
      subFixture({ estado: 'past_due', current_period_end: periodEnd }),
    );
    const snapshot = await getSubscriptionStatus(42);
    expect(snapshot?.hasAccess).toBe(true);
  });

  it('revoca acceso cuando past_due excede la ventana de gracia', async () => {
    const periodEnd = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(
      subFixture({ estado: 'past_due', current_period_end: periodEnd }),
    );
    const snapshot = await getSubscriptionStatus(42);
    expect(snapshot?.hasAccess).toBe(false);
  });

  it('bloquea cuando está canceled o unpaid', async () => {
    for (const estado of ['canceled', 'unpaid'] as const) {
      mocks.prisma.suscripciones.findUnique.mockResolvedValue(subFixture({ estado }));
      const snapshot = await getSubscriptionStatus(42);
      expect(snapshot?.hasAccess).toBe(false);
    }
  });

  it('expone mpPreapprovalId y mpPayerEmail', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(
      subFixture({ mp_preapproval_id: 'pre_abc', mp_payer_email: 'user@tenant.com' }),
    );
    const snapshot = await getSubscriptionStatus(42);
    expect(snapshot?.mpPreapprovalId).toBe('pre_abc');
    expect(snapshot?.mpPayerEmail).toBe('user@tenant.com');
  });

  it('getSubscriptionStatusFresh bypasea el cache wrapper', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(subFixture());
    const snapshot = await getSubscriptionStatusFresh(42);
    expect(snapshot?.hasAccess).toBe(true);
  });
});

// ── mapMpPreapprovalStatus ──

describe('mapMpPreapprovalStatus', () => {
  it.each([
    ['pending', 'trialing'],
    ['authorized', 'active'],
    ['paused', 'past_due'],
    ['cancelled', 'canceled'],
    ['expired', 'unpaid'],
    ['unknown-value', 'trialing'],
  ])('mapea %s → %s', (mpStatus, expected) => {
    expect(mapMpPreapprovalStatus(mpStatus)).toBe(expected);
  });
});

// ── markSubscriptionCanceled ──

describe('markSubscriptionCanceled', () => {
  it('actualiza la fila por mp_preapproval_id', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue({ tenant_id: 42 });
    mocks.prisma.suscripciones.update.mockResolvedValue({});
    await markSubscriptionCanceled('preapp_xyz');
    const call = mocks.prisma.suscripciones.update.mock.calls[0][0];
    expect(call.where).toEqual({ mp_preapproval_id: 'preapp_xyz' });
    expect(call.data.estado).toBe('canceled');
    expect(call.data.canceled_at).toBeInstanceOf(Date);
  });

  it('es no-op cuando no hay fila matcheando', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(null);
    await markSubscriptionCanceled('preapp_ghost');
    expect(mocks.prisma.suscripciones.update).not.toHaveBeenCalled();
  });
});

// ── syncSubscriptionFromMp ──

describe('syncSubscriptionFromMp', () => {
  it('actualiza la fila con el estado mapeado y current_period_end', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue({ tenant_id: 42 });
    mocks.prisma.suscripciones.update.mockResolvedValue({});
    const next = new Date('2026-06-20T00:00:00Z');
    await syncSubscriptionFromMp({
      mpPreapprovalId: 'preapp_1',
      status: 'authorized',
      nextPaymentDate: next,
      canceledAt: null,
    });
    const call = mocks.prisma.suscripciones.update.mock.calls[0][0];
    expect(call.where).toEqual({ mp_preapproval_id: 'preapp_1' });
    expect(call.data.estado).toBe('active');
    expect(call.data.current_period_end).toEqual(next);
  });

  it('descarta silenciosamente preapprovals que no conocemos (orphan webhook)', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(null);
    await syncSubscriptionFromMp({
      mpPreapprovalId: 'preapp_unknown',
      status: 'authorized',
      nextPaymentDate: null,
      canceledAt: null,
    });
    expect(mocks.prisma.suscripciones.update).not.toHaveBeenCalled();
  });

  it('mapea paused → past_due', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue({ tenant_id: 42 });
    mocks.prisma.suscripciones.update.mockResolvedValue({});
    await syncSubscriptionFromMp({
      mpPreapprovalId: 'preapp_paused',
      status: 'paused',
      nextPaymentDate: null,
      canceledAt: null,
    });
    const call = mocks.prisma.suscripciones.update.mock.calls[0][0];
    expect(call.data.estado).toBe('past_due');
  });
});

// ── attachMpPreapprovalToTenant ──

describe('attachMpPreapprovalToTenant', () => {
  it('activa la suscripción y guarda los IDs de MP', async () => {
    mocks.prisma.suscripciones.update.mockResolvedValue({});
    const start = new Date('2026-04-20T00:00:00Z');
    const end = new Date('2026-05-20T00:00:00Z');
    await attachMpPreapprovalToTenant({
      tenantId: 42,
      mpPreapprovalId: 'preapp_new',
      payerEmail: 'payer@new.com',
      currentPeriodStart: start,
      currentPeriodEnd: end,
    });
    const call = mocks.prisma.suscripciones.update.mock.calls[0][0];
    expect(call.where).toEqual({ tenant_id: 42 });
    expect(call.data.mp_preapproval_id).toBe('preapp_new');
    expect(call.data.mp_payer_email).toBe('payer@new.com');
    expect(call.data.estado).toBe('active');
    expect(call.data.current_period_start).toEqual(start);
    expect(call.data.current_period_end).toEqual(end);
    expect(call.data.cancel_at_period_end).toBe(false);
    expect(call.data.canceled_at).toBeNull();
  });
});
