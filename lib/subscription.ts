import { prisma } from './prisma';
import { cached, invalidateTenantCache } from './cache';

export type SubscriptionEstado = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';

export type SubscriptionSnapshot = {
  tenantId: number;
  planId: number;
  planNombre: string;
  estado: SubscriptionEstado;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  mpPreapprovalId: string | null;
  mpPayerEmail: string | null;
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
      // Short grace window tras fallo de cobro antes de bloquear.
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
    mpPreapprovalId: sub.mp_preapproval_id,
    mpPayerEmail: sub.mp_payer_email,
    hasAccess,
    trialDaysLeft,
  };
}

/** Cached read de una suscripción. Usado por el proxy (hot path). */
export async function getSubscriptionStatus(
  tenantId: number,
): Promise<SubscriptionSnapshot | null> {
  return cached(`t:${tenantId}:subscription`, CACHE_TTL_MS, () => fetchSnapshot(tenantId));
}

/** Uncached read — usar en handlers que mutan estado. */
export function getSubscriptionStatusFresh(tenantId: number): Promise<SubscriptionSnapshot | null> {
  return fetchSnapshot(tenantId);
}

/**
 * Mapea un estado de MP Preapproval a nuestro estado interno.
 *
 * MP preapproval.status:
 *   - pending   : el usuario todavía no autorizó → tratamos como trialing
 *   - authorized: autorizada y cobrando → active
 *   - paused    : MP pausó por fallo recurrente → past_due
 *   - cancelled : cancelada → canceled
 *   - expired   : tarjeta expiró, cuenta caducada → unpaid
 */
export function mapMpPreapprovalStatus(status: string): SubscriptionEstado {
  switch (status) {
    case 'authorized':
      return 'active';
    case 'paused':
      return 'past_due';
    case 'cancelled':
      return 'canceled';
    case 'expired':
      return 'unpaid';
    case 'pending':
    default:
      return 'trialing';
  }
}

/**
 * Invoked on preapproval authorization (webhook subscription_preapproval
 * con status=authorized). Ata una Preapproval recién creada al tenant que
 * estaba en trial, usando external_reference.
 */
export async function attachMpPreapprovalToTenant(args: {
  tenantId: number;
  mpPreapprovalId: string;
  payerEmail: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
}): Promise<void> {
  await prisma.suscripciones.update({
    where: { tenant_id: args.tenantId },
    data: {
      mp_preapproval_id: args.mpPreapprovalId,
      mp_payer_email: args.payerEmail,
      estado: 'active',
      current_period_start: args.currentPeriodStart,
      current_period_end: args.currentPeriodEnd,
      cancel_at_period_end: false,
      canceled_at: null,
    },
  });
  invalidateTenantCache(args.tenantId);
}

/**
 * Aplica un snapshot de preapproval de MP a la fila correspondiente.
 * Si no tenemos el preapproval en DB (orphan webhook), no-op.
 */
export async function syncSubscriptionFromMp(args: {
  mpPreapprovalId: string;
  status: string;
  nextPaymentDate: Date | null;
  canceledAt: Date | null;
}): Promise<void> {
  const existing = await prisma.suscripciones.findUnique({
    where: { mp_preapproval_id: args.mpPreapprovalId },
    select: { tenant_id: true },
  });
  if (!existing) return;

  await prisma.suscripciones.update({
    where: { mp_preapproval_id: args.mpPreapprovalId },
    data: {
      estado: mapMpPreapprovalStatus(args.status),
      current_period_end: args.nextPaymentDate,
      canceled_at: args.canceledAt,
    },
  });
  invalidateTenantCache(existing.tenant_id);
}

/** Marca una suscripción como cancelada por preapproval ID. */
export async function markSubscriptionCanceled(mpPreapprovalId: string): Promise<void> {
  const sub = await prisma.suscripciones.findUnique({
    where: { mp_preapproval_id: mpPreapprovalId },
    select: { tenant_id: true },
  });
  if (!sub) return;
  await prisma.suscripciones.update({
    where: { mp_preapproval_id: mpPreapprovalId },
    data: { estado: 'canceled', canceled_at: new Date() },
  });
  invalidateTenantCache(sub.tenant_id);
}
