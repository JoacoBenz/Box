import { describe, it, expect } from 'vitest';

import {
  BILLING_TAB_KEY,
  BILLING_BASE_PATH,
  BILLING_URL,
  billingUrl,
  BILLING_REASONS,
  isBillingReason,
  BILLING_BLOCKED_REASONS,
  isBillingBlockedReason,
} from '@/lib/billing-links';

// ── Constants ──

describe('BILLING_URL', () => {
  it('equals /perfil?tab=facturacion', () => {
    expect(BILLING_URL).toBe('/perfil?tab=facturacion');
  });

  it('is composed from BILLING_BASE_PATH and BILLING_TAB_KEY', () => {
    expect(BILLING_URL).toBe(`${BILLING_BASE_PATH}?tab=${BILLING_TAB_KEY}`);
  });
});

// ── billingUrl() ──

describe('billingUrl', () => {
  it('returns /perfil?tab=facturacion with no params', () => {
    expect(billingUrl()).toBe('/perfil?tab=facturacion');
  });

  it('appends reason param', () => {
    const url = billingUrl({ reason: 'canceled' });
    expect(url).toContain('tab=facturacion');
    expect(url).toContain('reason=canceled');
    expect(url.startsWith('/perfil?')).toBe(true);
  });

  it('appends multiple extra params', () => {
    const url = billingUrl({ reason: 'unpaid', checkout: 'success' });
    expect(url).toContain('tab=facturacion');
    expect(url).toContain('reason=unpaid');
    expect(url).toContain('checkout=success');
  });
});

// ── isBillingReason ──

describe('isBillingReason', () => {
  it.each(BILLING_REASONS.map((r) => [r]))('returns true for "%s"', (reason) => {
    expect(isBillingReason(reason)).toBe(true);
  });

  it('returns false for an unknown string', () => {
    expect(isBillingReason('unknown_status')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isBillingReason(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isBillingReason(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isBillingReason('')).toBe(false);
  });
});

// ── isBillingBlockedReason ──

describe('isBillingBlockedReason', () => {
  it.each(BILLING_BLOCKED_REASONS.map((r) => [r]))(
    'returns true for blocked reason "%s"',
    (reason) => {
      expect(isBillingBlockedReason(reason)).toBe(true);
    },
  );

  it('returns false for "active" (not a blocked reason)', () => {
    expect(isBillingBlockedReason('active')).toBe(false);
  });

  it('returns false for "trialing" (not a blocked reason)', () => {
    expect(isBillingBlockedReason('trialing')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isBillingBlockedReason(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isBillingBlockedReason(undefined)).toBe(false);
  });

  it('returns false for an arbitrary string', () => {
    expect(isBillingBlockedReason('whatever')).toBe(false);
  });
});
