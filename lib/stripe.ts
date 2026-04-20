import Stripe from 'stripe';

/**
 * Stripe SDK singleton.
 *
 * Billing is optional: when STRIPE_SECRET_KEY is not set, `stripe` is `null`
 * and callers must handle it. Use `isStripeEnabled()` / `requireStripe()` to
 * gate code paths that need Stripe.
 */

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client = new Stripe(key, {
    apiVersion: '2026-03-25.dahlia',
    appInfo: { name: 'Box', url: 'https://box.app' },
    typescript: true,
  });
  return client;
}

export function isStripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PRICE_ID;
}

export function requireStripe(): Stripe {
  const s = getStripe();
  if (!s) {
    throw new Error(
      'Stripe is not configured. Set STRIPE_SECRET_KEY (and STRIPE_PRICE_ID for subscriptions).',
    );
  }
  return s;
}
