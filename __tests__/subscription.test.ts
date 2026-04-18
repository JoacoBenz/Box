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
// Identity cache: the TTL logic is already covered by cache.test.ts.
vi.mock('@/lib/cache', () => ({
  cached: <T>(_key: string, _ttl: number, fetcher: () => Promise<T>) => fetcher(),
  invalidateTenantCache: vi.fn(),
}));

import {
  createTrialSubscription,
  getSubscriptionStatus,
  getSubscriptionStatusFresh,
  stripeSubscriptionToColumns,
  markSubscriptionCanceled,
  syncSubscriptionFromStripe,
  attachStripeSubscriptionToTenant,
} from '@/lib/subscription';

const defaultPlan = {
  id: 1,
  nombre: 'box-principal',
  precio_ars: 152000,
  trial_dias: 14,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── createTrialSubscription ──

describe('createTrialSubscription', () => {
  it('creates a 14-day trial linked to the default plan', async () => {
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
    // trial_ends_at should be roughly +14 days from now
    const delta = data.trial_ends_at.getTime() - data.trial_starts_at.getTime();
    expect(delta).toBe(14 * 24 * 60 * 60 * 1000);
    expect(data.trial_starts_at.getTime()).toBeGreaterThanOrEqual(before);
    expect(data.trial_starts_at.getTime()).toBeLessThanOrEqual(after);
  });

  it('throws a helpful error when the default plan is missing', async () => {
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
    stripe_customer_id: 'cus_x',
    stripe_subscription_id: 'sub_x',
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
  it('returns null when the tenant has no subscription', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(null);
    const snapshot = await getSubscriptionStatus(42);
    expect(snapshot).toBeNull();
  });

  it('grants access while the trial is still valid', async () => {
    const trialEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(
      subFixture({ estado: 'trialing', trial_ends_at: trialEnd }),
    );
    const snapshot = await getSubscriptionStatus(42);
    expect(snapshot?.hasAccess).toBe(true);
    expect(snapshot?.estado).toBe('trialing');
    // 5 days, not counting fractional excess — ceil
    expect(snapshot?.trialDaysLeft).toBe(5);
  });

  it('denies access when the trial expired', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(
      subFixture({ estado: 'trialing', trial_ends_at: new Date(Date.now() - 1000) }),
    );
    const snapshot = await getSubscriptionStatus(42);
    expect(snapshot?.hasAccess).toBe(false);
    expect(snapshot?.trialDaysLeft).toBe(0);
  });

  it('grants access to active subs', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(subFixture({ estado: 'active' }));
    const snapshot = await getSubscriptionStatus(42);
    expect(snapshot?.hasAccess).toBe(true);
    expect(snapshot?.trialDaysLeft).toBeNull();
  });

  it('grants 3 days of grace on past_due', async () => {
    const periodEnd = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(
      subFixture({ estado: 'past_due', current_period_end: periodEnd }),
    );
    const snapshot = await getSubscriptionStatus(42);
    expect(snapshot?.hasAccess).toBe(true);
  });

  it('revokes access when past_due exceeds the grace window', async () => {
    const periodEnd = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(
      subFixture({ estado: 'past_due', current_period_end: periodEnd }),
    );
    const snapshot = await getSubscriptionStatus(42);
    expect(snapshot?.hasAccess).toBe(false);
  });

  it('denies access when canceled or unpaid', async () => {
    for (const estado of ['canceled', 'unpaid'] as const) {
      mocks.prisma.suscripciones.findUnique.mockResolvedValue(subFixture({ estado }));
      const snapshot = await getSubscriptionStatus(42);
      expect(snapshot?.hasAccess).toBe(false);
    }
  });

  it('getSubscriptionStatusFresh bypasses the cache wrapper', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(subFixture());
    const snapshot = await getSubscriptionStatusFresh(42);
    expect(snapshot?.hasAccess).toBe(true);
  });
});

// ── stripeSubscriptionToColumns ──

describe('stripeSubscriptionToColumns', () => {
  it('maps a Stripe.Subscription into our DB shape', () => {
    const sub = {
      id: 'sub_123',
      status: 'active',
      customer: 'cus_abc',
      cancel_at_period_end: false,
      canceled_at: null,
      items: {
        data: [
          {
            current_period_start: 1_700_000_000,
            current_period_end: 1_702_592_000,
          },
        ],
      },
    } as any;
    const cols = stripeSubscriptionToColumns(sub);
    expect(cols.estado).toBe('active');
    expect(cols.stripe_subscription_id).toBe('sub_123');
    expect(cols.stripe_customer_id).toBe('cus_abc');
    expect(cols.current_period_start).toEqual(new Date(1_700_000_000 * 1000));
    expect(cols.current_period_end).toEqual(new Date(1_702_592_000 * 1000));
    expect(cols.cancel_at_period_end).toBe(false);
    expect(cols.canceled_at).toBeNull();
  });

  it('falls back to root-level period fields when items are absent', () => {
    const sub = {
      id: 'sub_old',
      status: 'trialing',
      customer: { id: 'cus_abc' },
      cancel_at_period_end: false,
      canceled_at: null,
      current_period_start: 1_700_000_000,
      current_period_end: 1_702_592_000,
      items: { data: [] },
    } as any;
    const cols = stripeSubscriptionToColumns(sub);
    expect(cols.estado).toBe('trialing');
    expect(cols.stripe_customer_id).toBe('cus_abc');
    expect(cols.current_period_start).toEqual(new Date(1_700_000_000 * 1000));
  });

  it.each([
    ['active', 'active'],
    ['trialing', 'trialing'],
    ['past_due', 'past_due'],
    ['canceled', 'canceled'],
    ['unpaid', 'unpaid'],
    ['incomplete', 'unpaid'],
    ['incomplete_expired', 'unpaid'],
    ['paused', 'unpaid'],
  ])('maps Stripe status %s → %s', (stripeStatus, expected) => {
    const cols = stripeSubscriptionToColumns({
      id: 's',
      status: stripeStatus,
      customer: 'c',
      cancel_at_period_end: false,
      canceled_at: null,
      items: { data: [] },
    } as any);
    expect(cols.estado).toBe(expected);
  });
});

// ── markSubscriptionCanceled ──

describe('markSubscriptionCanceled', () => {
  it('updates the row by stripe_subscription_id', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue({ tenant_id: 42 });
    mocks.prisma.suscripciones.update.mockResolvedValue({});
    await markSubscriptionCanceled('sub_xyz');
    const call = mocks.prisma.suscripciones.update.mock.calls[0][0];
    expect(call.where).toEqual({ stripe_subscription_id: 'sub_xyz' });
    expect(call.data.estado).toBe('canceled');
    expect(call.data.canceled_at).toBeInstanceOf(Date);
  });

  it('is a no-op when no matching row exists', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(null);
    await markSubscriptionCanceled('sub_ghost');
    expect(mocks.prisma.suscripciones.update).not.toHaveBeenCalled();
  });
});

// ── syncSubscriptionFromStripe ──

describe('syncSubscriptionFromStripe', () => {
  it('updates the owning row with columns derived from Stripe', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue({ tenant_id: 42 });
    mocks.prisma.suscripciones.update.mockResolvedValue({});
    const sub = {
      id: 'sub_1',
      status: 'active',
      customer: 'cus_a',
      cancel_at_period_end: false,
      canceled_at: null,
      items: {
        data: [{ current_period_start: 1, current_period_end: 2 }],
      },
    } as any;
    await syncSubscriptionFromStripe(sub);
    const call = mocks.prisma.suscripciones.update.mock.calls[0][0];
    expect(call.where).toEqual({ stripe_subscription_id: 'sub_1' });
    expect(call.data.estado).toBe('active');
  });

  it('silently drops subscriptions we do not own (orphan webhook)', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(null);
    await syncSubscriptionFromStripe({
      id: 'sub_unknown',
      status: 'active',
      customer: 'x',
      cancel_at_period_end: false,
      canceled_at: null,
      items: { data: [] },
    } as any);
    expect(mocks.prisma.suscripciones.update).not.toHaveBeenCalled();
  });
});

// ── attachStripeSubscriptionToTenant ──

describe('attachStripeSubscriptionToTenant', () => {
  it('activates the tenant subscription and stores Stripe IDs', async () => {
    mocks.prisma.suscripciones.update.mockResolvedValue({});
    await attachStripeSubscriptionToTenant({
      tenantId: 42,
      stripeCustomerId: 'cus_new',
      stripeSubscriptionId: 'sub_new',
    });
    const call = mocks.prisma.suscripciones.update.mock.calls[0][0];
    expect(call.where).toEqual({ tenant_id: 42 });
    expect(call.data.stripe_customer_id).toBe('cus_new');
    expect(call.data.stripe_subscription_id).toBe('sub_new');
    expect(call.data.estado).toBe('active');
  });
});
