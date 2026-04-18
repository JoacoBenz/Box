import { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import {
  attachStripeSubscriptionToTenant,
  markSubscriptionCanceled,
  syncSubscriptionFromStripe,
} from '@/lib/subscription';
import { logApiError } from '@/lib/logger';

/**
 * Stripe webhook endpoint.
 *
 * Verifies the signature against STRIPE_WEBHOOK_SECRET and dispatches
 * subscription/invoice events to the subscription sync helpers.
 *
 * Public (no auth) — protection comes from the Stripe signature.
 * Always returns 200 for successfully-processed events so Stripe stops
 * retrying; 400 for signature failures; 500 for handler errors.
 */

// Next.js: we need the raw body (string) to verify the Stripe signature.
export const dynamic = 'force-dynamic';

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = Number(session.client_reference_id);
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (!Number.isFinite(tenantId) || !customerId || !subscriptionId) return;
      await attachStripeSubscriptionToTenant({
        tenantId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      });
      return;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.trial_will_end':
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      // For invoice events, Stripe gives us the subscription via retrieval.
      const stripe = getStripe();
      if (!stripe) return;
      let subscription: Stripe.Subscription | null = null;
      if (
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.trial_will_end'
      ) {
        subscription = event.data.object as Stripe.Subscription;
      } else {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceAny = invoice as unknown as {
          subscription?: string | { id: string } | null;
        };
        const subId =
          typeof invoiceAny.subscription === 'string'
            ? invoiceAny.subscription
            : invoiceAny.subscription?.id;
        if (!subId) return;
        subscription = await stripe.subscriptions.retrieve(subId);
      }
      if (subscription) {
        await syncSubscriptionFromStripe(subscription);
      }
      return;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await markSubscriptionCanceled(sub.id);
      return;
    }

    default:
      // Ignore other events — we don't care about them.
      return;
  }
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return Response.json(
      { error: { code: 'STRIPE_DISABLED', message: 'Stripe no está configurado' } },
      { status: 503 },
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return Response.json(
      { error: { code: 'BAD_REQUEST', message: 'Missing stripe-signature header' } },
      { status: 400 },
    );
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logApiError('/api/stripe/webhook', 'POST', err);
    return Response.json(
      { error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } },
      { status: 400 },
    );
  }

  try {
    await handleEvent(event);
    return Response.json({ received: true });
  } catch (err) {
    logApiError('/api/stripe/webhook', 'POST', err);
    // Return 500 so Stripe retries.
    return Response.json(
      { error: { code: 'HANDLER_ERROR', message: 'Error processing event' } },
      { status: 500 },
    );
  }
}
