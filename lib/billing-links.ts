/**
 * Canonical identifiers for the billing section of the app.
 *
 * Billing vive como tab dentro de `/perfil` (accesible solo a director /
 * admin / super_admin). La ruta legacy `/facturacion` se mantiene como
 * redirect transparente — los enlaces internos deberían apuntar directo
 * al tab vía `billingUrl(...)`.
 */

/** Tab key dentro de `/perfil`. Tiene que matchear lo que usa `<Tabs>`. */
export const BILLING_TAB_KEY = 'facturacion';

/** Path base sin query — útil para `startsWith` en proxy/handlers. */
export const BILLING_BASE_PATH = '/perfil';

/** URL canónica para abrir el tab de Facturación desde un Link o redirect. */
export const BILLING_URL = `${BILLING_BASE_PATH}?tab=${BILLING_TAB_KEY}`;

/**
 * Construye una URL al tab de Facturación con query params adicionales.
 * Útil para reason codes del proxy, checkout success flag, etc.
 *
 *   billingUrl({ reason: 'canceled' })
 *   // => '/perfil?tab=facturacion&reason=canceled'
 */
export function billingUrl(params?: Record<string, string>): string {
  const qs = new URLSearchParams({ tab: BILLING_TAB_KEY, ...params });
  return `${BILLING_BASE_PATH}?${qs.toString()}`;
}

/**
 * Reasons conocidos que el proxy o la UI pueden propagar al tab.
 * Usados tanto en `/perfil` (para auto-seleccionar el tab) como en
 * el alert de usuarios sin permisos.
 */
export const BILLING_REASONS = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'no_subscription',
] as const;

export type BillingReason = (typeof BILLING_REASONS)[number];

export function isBillingReason(value: string | null | undefined): value is BillingReason {
  return !!value && (BILLING_REASONS as readonly string[]).includes(value);
}

/** Reasons que implican que el tenant no tiene acceso al producto. */
export const BILLING_BLOCKED_REASONS: readonly BillingReason[] = [
  'canceled',
  'unpaid',
  'no_subscription',
];

export function isBillingBlockedReason(value: string | null | undefined): boolean {
  return !!value && (BILLING_BLOCKED_REASONS as readonly string[]).includes(value);
}
