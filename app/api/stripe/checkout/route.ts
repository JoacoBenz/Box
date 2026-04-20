import { withAuth } from '@/lib/api-handler';
import { getStripe, isStripeEnabled } from '@/lib/stripe';
import { getSubscriptionStatusFresh } from '@/lib/subscription';
import { prisma } from '@/lib/prisma';
import { logApiError } from '@/lib/logger';

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session so an admin can convert the tenant's
 * trial into a paid subscription. Returns { url } which the client
 * redirects to.
 */
export const POST = withAuth({ roles: ['admin', 'super_admin'] }, async (request, { session }) => {
  if (!isStripeEnabled()) {
    return Response.json(
      { error: { code: 'STRIPE_DISABLED', message: 'Stripe no está configurado' } },
      { status: 503 },
    );
  }
  const stripe = getStripe()!;
  const priceId = process.env.STRIPE_PRICE_ID!;

  const subscription = await getSubscriptionStatusFresh(session.tenantId);
  if (!subscription) {
    return Response.json(
      {
        error: {
          code: 'NO_SUBSCRIPTION',
          message: 'No hay suscripción asociada a la organización',
        },
      },
      { status: 404 },
    );
  }
  if (subscription.estado === 'active') {
    return Response.json(
      {
        error: {
          code: 'ALREADY_ACTIVE',
          message: 'La suscripción ya está activa',
        },
      },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const returnUrl: string = body.return_url ?? `${request.headers.get('origin')}/facturacion`;
  const cancelUrl: string = body.cancel_url ?? `${request.headers.get('origin')}/facturacion`;

  try {
    // Reuse existing Stripe customer if we have one; otherwise create one.
    let customerId = subscription.stripeCustomerId;
    if (!customerId) {
      const tenant = await prisma.tenants.findUnique({
        where: { id: session.tenantId },
        select: { nombre: true, email_contacto: true },
      });
      const customer = await stripe.customers.create({
        email: session.email ?? tenant?.email_contacto ?? undefined,
        name: tenant?.nombre,
        metadata: { tenant_id: String(session.tenantId) },
      });
      customerId = customer.id;
      await prisma.suscripciones.update({
        where: { tenant_id: session.tenantId },
        data: { stripe_customer_id: customerId },
      });
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: String(session.tenantId),
      success_url: `${returnUrl}?checkout=success`,
      cancel_url: cancelUrl,
      metadata: { tenant_id: String(session.tenantId) },
    });

    if (!checkout.url) {
      return Response.json(
        { error: { code: 'CHECKOUT_ERROR', message: 'Stripe no devolvió una URL' } },
        { status: 502 },
      );
    }
    return Response.json({ url: checkout.url });
  } catch (err) {
    logApiError('/api/stripe/checkout', 'POST', err);
    return Response.json(
      { error: { code: 'CHECKOUT_ERROR', message: 'No se pudo crear el checkout' } },
      { status: 500 },
    );
  }
});
