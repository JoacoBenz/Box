import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
    subscriptions: { retrieve: vi.fn() },
  },
  subscription: {
    attachStripeSubscriptionToTenant: vi.fn(),
    syncSubscriptionFromStripe: vi.fn(),
    markSubscriptionCanceled: vi.fn(),
  },
}));

vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => mocks.stripe),
}));
vi.mock('@/lib/subscription', () => mocks.subscription);
vi.mock('@/lib/logger', () => ({ logApiError: vi.fn() }));

// Webhook reads STRIPE_WEBHOOK_SECRET from env at request time; we set it
// here rather than relying on .env.* so tests are deterministic.
const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, STRIPE_WEBHOOK_SECRET: 'whsec_test' };
  vi.clearAllMocks();
});

import { POST } from '@/app/api/stripe/webhook/route';

function makeRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('https://app.test/api/stripe/webhook', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('POST /api/stripe/webhook', () => {
  it('returns 503 when Stripe is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(makeRequest('{}'));
    expect(res.status).toBe(503);
  });

  it('returns 400 when the stripe-signature header is missing', async () => {
    const res = await POST(makeRequest('{}'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('BAD_REQUEST');
    expect(mocks.stripe.webhooks.constructEvent).not.toHaveBeenCalled();
  });

  it('returns 400 when the signature is invalid', async () => {
    mocks.stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const res = await POST(makeRequest('{}', { 'stripe-signature': 'sig_bad' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('INVALID_SIGNATURE');
  });

  it('dispatches checkout.session.completed to attachStripeSubscriptionToTenant', async () => {
    mocks.stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: '42',
          customer: 'cus_new',
          subscription: 'sub_new',
        },
      },
    });
    const res = await POST(makeRequest('{}', { 'stripe-signature': 'sig_ok' }));
    expect(res.status).toBe(200);
    expect(mocks.subscription.attachStripeSubscriptionToTenant).toHaveBeenCalledWith({
      tenantId: 42,
      stripeCustomerId: 'cus_new',
      stripeSubscriptionId: 'sub_new',
    });
  });

  it('ignores checkout.session.completed with missing ids (defensive)', async () => {
    mocks.stripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { client_reference_id: 'not-a-number' } },
    });
    const res = await POST(makeRequest('{}', { 'stripe-signature': 'sig_ok' }));
    expect(res.status).toBe(200);
    expect(mocks.subscription.attachStripeSubscriptionToTenant).not.toHaveBeenCalled();
  });

  it('dispatches customer.subscription.updated to syncSubscriptionFromStripe', async () => {
    const stripeSub = {
      id: 'sub_1',
      status: 'active',
      customer: 'cus_a',
      cancel_at_period_end: false,
      canceled_at: null,
      items: { data: [] },
    };
    mocks.stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: stripeSub },
    });
    const res = await POST(makeRequest('{}', { 'stripe-signature': 'sig_ok' }));
    expect(res.status).toBe(200);
    expect(mocks.subscription.syncSubscriptionFromStripe).toHaveBeenCalledWith(stripeSub);
  });

  it('retrieves and syncs the subscription for invoice.paid events', async () => {
    const stripeSub = {
      id: 'sub_inv',
      status: 'active',
      customer: 'cus_a',
      cancel_at_period_end: false,
      canceled_at: null,
      items: { data: [] },
    };
    mocks.stripe.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.paid',
      data: { object: { subscription: 'sub_inv' } },
    });
    mocks.stripe.subscriptions.retrieve.mockResolvedValue(stripeSub);
    const res = await POST(makeRequest('{}', { 'stripe-signature': 'sig_ok' }));
    expect(res.status).toBe(200);
    expect(mocks.stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_inv');
    expect(mocks.subscription.syncSubscriptionFromStripe).toHaveBeenCalledWith(stripeSub);
  });

  it('dispatches invoice.payment_failed via subscription retrieval', async () => {
    const stripeSub = {
      id: 'sub_fail',
      status: 'past_due',
      customer: 'cus_a',
      cancel_at_period_end: false,
      canceled_at: null,
      items: { data: [] },
    };
    mocks.stripe.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_fail' } },
    });
    mocks.stripe.subscriptions.retrieve.mockResolvedValue(stripeSub);
    const res = await POST(makeRequest('{}', { 'stripe-signature': 'sig_ok' }));
    expect(res.status).toBe(200);
    expect(mocks.subscription.syncSubscriptionFromStripe).toHaveBeenCalledWith(stripeSub);
  });

  it('skips invoice events without an attached subscription', async () => {
    mocks.stripe.webhooks.constructEvent.mockReturnValue({
      type: 'invoice.paid',
      data: { object: {} },
    });
    const res = await POST(makeRequest('{}', { 'stripe-signature': 'sig_ok' }));
    expect(res.status).toBe(200);
    expect(mocks.stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(mocks.subscription.syncSubscriptionFromStripe).not.toHaveBeenCalled();
  });

  it('dispatches customer.subscription.deleted to markSubscriptionCanceled', async () => {
    mocks.stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_gone' } },
    });
    const res = await POST(makeRequest('{}', { 'stripe-signature': 'sig_ok' }));
    expect(res.status).toBe(200);
    expect(mocks.subscription.markSubscriptionCanceled).toHaveBeenCalledWith('sub_gone');
  });

  it('acks unknown events without dispatching anything', async () => {
    mocks.stripe.webhooks.constructEvent.mockReturnValue({
      type: 'charge.refunded',
      data: { object: {} },
    });
    const res = await POST(makeRequest('{}', { 'stripe-signature': 'sig_ok' }));
    expect(res.status).toBe(200);
    expect(mocks.subscription.attachStripeSubscriptionToTenant).not.toHaveBeenCalled();
    expect(mocks.subscription.syncSubscriptionFromStripe).not.toHaveBeenCalled();
    expect(mocks.subscription.markSubscriptionCanceled).not.toHaveBeenCalled();
  });

  it('returns 500 when the handler itself throws (so Stripe retries)', async () => {
    mocks.stripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_boom' } },
    });
    mocks.subscription.markSubscriptionCanceled.mockRejectedValue(new Error('db down'));
    const res = await POST(makeRequest('{}', { 'stripe-signature': 'sig_ok' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe('HANDLER_ERROR');
  });
});
