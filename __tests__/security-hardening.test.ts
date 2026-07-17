import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { isCronAuthorized } from '@/lib/cron-auth';
import { verifyMpSignature } from '@/lib/mercadopago';
import { escapeHtml } from '@/lib/email';

// ── lib/cron-auth ──

function cronRequest(secret?: string) {
  const headers = secret ? { 'x-cron-secret': secret } : undefined;
  // isCronAuthorized only reads headers.get(), so a plain Request suffices.
  return new Request('http://localhost/api/cron/alertas', { headers }) as never;
}

describe('isCronAuthorized', () => {
  const ORIGINAL = process.env.CRON_SECRET;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL;
  });

  it('fails closed when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET;
    expect(isCronAuthorized(cronRequest('anything'))).toBe(false);
    expect(isCronAuthorized(cronRequest())).toBe(false);
  });

  it('rejects a missing header', () => {
    process.env.CRON_SECRET = 'topsecret';
    expect(isCronAuthorized(cronRequest())).toBe(false);
  });

  it('rejects a wrong secret', () => {
    process.env.CRON_SECRET = 'topsecret';
    expect(isCronAuthorized(cronRequest('wrong'))).toBe(false);
  });

  it('rejects a secret with matching prefix but different length', () => {
    process.env.CRON_SECRET = 'topsecret';
    expect(isCronAuthorized(cronRequest('topsecret-extra'))).toBe(false);
  });

  it('accepts the correct secret', () => {
    process.env.CRON_SECRET = 'topsecret';
    expect(isCronAuthorized(cronRequest('topsecret'))).toBe(true);
  });
});

// ── verifyMpSignature: anti-replay ──

const MP_SECRET = 'mp-test-secret';

function signedArgs(ts: string) {
  const dataId = 'preapproval-123';
  const requestId = 'req-1';
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac('sha256', MP_SECRET).update(manifest).digest('hex');
  return {
    signatureHeader: `ts=${ts},v1=${v1}`,
    requestIdHeader: requestId,
    dataId,
    secret: MP_SECRET,
  };
}

describe('verifyMpSignature replay protection', () => {
  it('accepts a correctly signed, fresh notification', () => {
    expect(verifyMpSignature(signedArgs(String(Date.now())))).toBe(true);
  });

  it('rejects a valid signature older than 5 minutes', () => {
    const stale = String(Date.now() - 6 * 60 * 1000);
    expect(verifyMpSignature(signedArgs(stale))).toBe(false);
  });

  it('rejects a valid signature with a far-future timestamp', () => {
    const future = String(Date.now() + 6 * 60 * 1000);
    expect(verifyMpSignature(signedArgs(future))).toBe(false);
  });

  it('rejects a non-numeric timestamp', () => {
    expect(verifyMpSignature(signedArgs('not-a-number'))).toBe(false);
  });

  it('still rejects a tampered signature even when fresh', () => {
    const args = signedArgs(String(Date.now()));
    args.signatureHeader = args.signatureHeader.replace(/v1=./, 'v1=0');
    expect(verifyMpSignature(args)).toBe(false);
  });
});

// ── escapeHtml ──

describe('escapeHtml', () => {
  it('escapes all HTML-significant characters', () => {
    expect(escapeHtml(`<script>alert("x&y")</script>'`)).toBe(
      '&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;&#39;',
    );
  });

  it('leaves normal names untouched', () => {
    expect(escapeHtml('Paula Méndez')).toBe('Paula Méndez');
  });
});
