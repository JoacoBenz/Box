import { withAuth } from '@/lib/api-handler';
import { getStripe, isStripeEnabled } from '@/lib/stripe';
import { getSubscriptionStatusFresh } from '@/lib/subscription';
import { logApiError } from '@/lib/logger';

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Billing Portal session so an admin can update payment
 * methods, cancel, or download invoices. Returns { url }.
 */
export const POST = withAuth({ roles: ['admin', 'super_admin'] }, async (request, { session }) => {
  if (!isStripeEnabled()) {
    return Response.json(
      { error: { code: 'STRIPE_DISABLED', message: 'Stripe no está configurado' } },
      { status: 503 },
    );
  }
  const stripe = getStripe()!;

  const subscription = await getSubscriptionStatusFresh(session.tenantId);
  if (!subscription?.stripeCustomerId) {
    return Response.json(
      {
        error: {
          code: 'NO_CUSTOMER',
          message: 'Todavía no tenés una suscripción activa. Activá el plan primero.',
        },
      },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const returnUrl: string = body.return_url ?? `${request.headers.get('origin')}/facturacion`;

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    });
    return Response.json({ url: portal.url });
  } catch (err) {
    logApiError('/api/stripe/portal', 'POST', err);
    return Response.json(
      { error: { code: 'PORTAL_ERROR', message: 'No se pudo abrir el portal' } },
      { status: 500 },
    );
  }
});
