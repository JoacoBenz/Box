import { prisma } from './prisma';
import { cached, invalidateTenantCache } from './cache';
import type Stripe from 'stripe';

export type SubscriptionEstado = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';

export type SubscriptionSnapshot = {
  tenantId: number;
  planId: number;
  planNombre: string;
  estado: SubscriptionEstado;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  /** true when the tenant can still use the product right now. */
  hasAccess: boolean;
  /** days left in trial, >=0, or null if not trialing. */
  trialDaysLeft: number | null;
};

const GRACE_DAYS_PAST_DUE = 3;
const CACHE_TTL_MS = 30_000;

const DEFAULT_PLAN_NOMBRE = 'box-principal';

/** Create a 14-day trial subscription for a freshly-created tenant. */
export async function createTrialSubscription(tenantId: number): Promise<void> {
  const plan = await prisma.planes.findUnique({ where: { nombre: DEFAULT_PLAN_NOMBRE } });
  if (!plan) {
    throw new Error(
      `Default plan '${DEFAULT_PLAN_NOMBRE}' not found. Run 'npx prisma db seed' first.`,
    );
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + plan.trial_dias * 24 * 60 * 60 * 1000);

  await prisma.suscripciones.create({
    data: {
      tenant_id: tenantId,
      plan_id: plan.id,
      estado: 'trialing',
      trial_starts_at: now,
      trial_ends_at: trialEndsAt,
    },
  });

  invalidateTenantCache(tenantId);
}

async function fetchSnapshot(tenantId: number): Promise<SubscriptionSnapshot | null> {
  const sub = await prisma.suscripciones.findUnique({
    where: { tenant_id: tenantId },
    include: { plan: true },
  });
  if (!sub) return null;

  const now = Date.now();
  const estado = sub.estado as SubscriptionEstado;

  let hasAccess = false;
  switch (estado) {
    case 'trialing':
      hasAccess = !!sub.trial_ends_at && sub.trial_ends_at.getTime() > now;
      break;
    case 'active':
      hasAccess = true;
      break;
    case 'past_due': {
      // Allow a short grace window after the failed payment before blocking.
      const anchor = sub.current_period_end?.getTime() ?? sub.updated_at.getTime();
      hasAccess = now < anchor + GRACE_DAYS_PAST_DUE * 24 * 60 * 60 * 1000;
      break;
    }
    case 'canceled':
    case 'unpaid':
      hasAccess = false;
      break;
  }

  const trialDaysLeft =
    estado === 'trialing' && sub.trial_ends_at
      ? Math.max(0, Math.ceil((sub.trial_ends_at.getTime() - now) / (24 * 60 * 60 * 1000)))
      : null;

  return {
    tenantId: sub.tenant_id,
    planId: sub.plan_id,
    planNombre: sub.plan.nombre,
    estado,
    trialEndsAt: sub.trial_ends_at,
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    stripeCustomerId: sub.stripe_customer_id,
    stripeSubscriptionId: sub.stripe_subscription_id,
    hasAccess,
    trialDaysLeft,
  };
}

/** Cached read of a tenant's subscription. Use from the proxy (hot path). */
export async function getSubscriptionStatus(
  tenantId: number,
): Promise<SubscriptionSnapshot | null> {
  return cached(`t:${tenantId}:subscription`, CACHE_TTL_MS, () => fetchSnapshot(tenantId));
}

/** Uncached read — use in handlers that mutate subscription state. */
export function getSubscriptionStatusFresh(tenantId: number): Promise<SubscriptionSnapshot | null> {
  return fetchSnapshot(tenantId);
}

/**
 * Map a Stripe Subscription object to our DB columns. Keeps the webhook
 * handler pure: given any sub from Stripe, it knows exactly what to write.
 */
export function stripeSubscriptionToColumns(sub: Stripe.Subscription) {
  const estado = mapStripeStatus(sub.status);
  // Stripe periods live on the subscription items since API 2025-09-30;
  // fall back to the root for older shapes to stay compatible.
  const stripeAny = sub as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const firstItem = sub.items?.data?.[0] as unknown as
    | { current_period_start?: number; current_period_end?: number }
    | undefined;
  const periodStart = firstItem?.current_period_start ?? stripeAny.current_period_start;
  const periodEnd = firstItem?.current_period_end ?? stripeAny.current_period_end;
  return {
    estado,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    current_period_start: periodStart ? new Date(periodStart * 1000) : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000) : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
  };
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionEstado {
  switch (status) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return 'unpaid';
    default:
      return 'unpaid';
  }
}

/** Mark a subscription as canceled (e.g. customer.subscription.deleted event). */
export async function markSubscriptionCanceled(stripeSubscriptionId: string): Promise<void> {
  const sub = await prisma.suscripciones.findUnique({
    where: { stripe_subscription_id: stripeSubscriptionId },
    select: { tenant_id: true },
  });
  if (!sub) return;
  await prisma.suscripciones.update({
    where: { stripe_subscription_id: stripeSubscriptionId },
    data: { estado: 'canceled', canceled_at: new Date() },
  });
  invalidateTenantCache(sub.tenant_id);
}

/** Apply a Stripe Subscription snapshot to the matching suscripciones row. */
export async function syncSubscriptionFromStripe(sub: Stripe.Subscription): Promise<void> {
  const data = stripeSubscriptionToColumns(sub);
  const existing = await prisma.suscripciones.findUnique({
    where: { stripe_subscription_id: sub.id },
    select: { tenant_id: true },
  });
  if (!existing) {
    // No-op: we only update subs we already own. Orphan webhooks can happen
    // during dev / across Stripe accounts; swallowing is safer than guessing
    // the tenant.
    return;
  }
  await prisma.suscripciones.update({
    where: { stripe_subscription_id: sub.id },
    data,
  });
  invalidateTenantCache(existing.tenant_id);
}

/**
 * Invoked on checkout.session.completed. Ties a freshly paid Stripe sub to
 * the tenant that was trialing, using client_reference_id carried through
 * checkout.
 */
export async function attachStripeSubscriptionToTenant(args: {
  tenantId: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
}): Promise<void> {
  await prisma.suscripciones.update({
    where: { tenant_id: args.tenantId },
    data: {
      stripe_customer_id: args.stripeCustomerId,
      stripe_subscription_id: args.stripeSubscriptionId,
      estado: 'active',
    },
  });
  invalidateTenantCache(args.tenantId);
}
