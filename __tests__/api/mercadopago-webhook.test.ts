import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

const mocks = vi.hoisted(() => ({
  preapproval: { get: vi.fn() },
  subscription: {
    attachMpPreapprovalToTenant: vi.fn(),
    syncSubscriptionFromMp: vi.fn(),
    markSubscriptionCanceled: vi.fn(),
  },
}));

vi.mock('@/lib/mercadopago', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mercadopago')>('@/lib/mercadopago');
  return {
    ...actual,
    getPreApproval: vi.fn(() => mocks.preapproval),
  };
});
vi.mock('@/lib/subscription', () => mocks.subscription);
vi.mock('@/lib/logger', () => ({ logApiError: vi.fn() }));

const ORIGINAL_ENV = { ...process.env };
const SECRET = 'whsec_test_mp';

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, MP_ACCESS_TOKEN: 'TEST-token', MP_WEBHOOK_SECRET: SECRET };
  vi.clearAllMocks();
});

import { POST } from '@/app/api/mercadopago/webhook/route';

/** Helper: arma una request con firma válida para un data.id dado. */
function makeSignedRequest(body: Record<string, unknown>, opts: { dataId: string }) {
  const ts = String(Date.now());
  const requestId = 'req_123';
  const manifest = `id:${opts.dataId};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac('sha256', SECRET).update(manifest).digest('hex');
  return new NextRequest('https://app.test/api/mercadopago/webhook', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'x-signature': `ts=${ts},v1=${v1}`,
      'x-request-id': requestId,
    },
  });
}

function makeUnsignedRequest(body: Record<string, unknown>) {
  return new NextRequest('https://app.test/api/mercadopago/webhook', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/mercadopago/webhook', () => {
  it('devuelve 503 cuando MP no está configurado', async () => {
    delete process.env.MP_WEBHOOK_SECRET;
    const res = await POST(makeUnsignedRequest({}));
    expect(res.status).toBe(503);
  });

  it('devuelve 400 cuando la firma es inválida', async () => {
    const body = { type: 'subscription_preapproval', data: { id: 'preapp_1' } };
    const req = new NextRequest('https://app.test/api/mercadopago/webhook', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
        'x-signature': 'ts=123,v1=deadbeef',
        'x-request-id': 'req_1',
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_SIGNATURE');
  });

  it('devuelve 400 cuando faltan headers de firma', async () => {
    const res = await POST(
      makeUnsignedRequest({ type: 'subscription_preapproval', data: { id: '1' } }),
    );
    expect(res.status).toBe(400);
  });

  it('ignora tipos de eventos que no nos importan (payment, plan)', async () => {
    const req = makeSignedRequest({ type: 'payment', data: { id: 'pay_1' } }, { dataId: 'pay_1' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.preapproval.get).not.toHaveBeenCalled();
  });

  it('en status=authorized atachea la preapproval al tenant via external_reference', async () => {
    mocks.preapproval.get.mockResolvedValue({
      id: 'preapp_ok',
      status: 'authorized',
      external_reference: '42',
      payer_email: 'alice@colegio.edu',
      date_created: '2026-04-20T00:00:00Z',
      next_payment_date: '2026-05-20T00:00:00Z',
    });
    const req = makeSignedRequest(
      { type: 'subscription_preapproval', data: { id: 'preapp_ok' } },
      { dataId: 'preapp_ok' },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.subscription.attachMpPreapprovalToTenant).toHaveBeenCalledWith({
      tenantId: 42,
      mpPreapprovalId: 'preapp_ok',
      payerEmail: 'alice@colegio.edu',
      currentPeriodStart: new Date('2026-04-20T00:00:00Z'),
      currentPeriodEnd: new Date('2026-05-20T00:00:00Z'),
    });
  });

  it('en status=cancelled marca la suscripción como cancelada', async () => {
    mocks.preapproval.get.mockResolvedValue({
      id: 'preapp_gone',
      status: 'cancelled',
      external_reference: '42',
    });
    const req = makeSignedRequest(
      { type: 'subscription_preapproval', data: { id: 'preapp_gone' } },
      { dataId: 'preapp_gone' },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.subscription.markSubscriptionCanceled).toHaveBeenCalledWith('preapp_gone');
  });

  it('en status=paused sincroniza (past_due) sin atachar ni cancelar', async () => {
    mocks.preapproval.get.mockResolvedValue({
      id: 'preapp_paused',
      status: 'paused',
      external_reference: '42',
      next_payment_date: '2026-06-20T00:00:00Z',
    });
    const req = makeSignedRequest(
      { type: 'subscription_preapproval', data: { id: 'preapp_paused' } },
      { dataId: 'preapp_paused' },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.subscription.syncSubscriptionFromMp).toHaveBeenCalledWith({
      mpPreapprovalId: 'preapp_paused',
      status: 'paused',
      nextPaymentDate: new Date('2026-06-20T00:00:00Z'),
      canceledAt: null,
    });
    expect(mocks.subscription.attachMpPreapprovalToTenant).not.toHaveBeenCalled();
    expect(mocks.subscription.markSubscriptionCanceled).not.toHaveBeenCalled();
  });

  it('devuelve 500 cuando el handler tira (MP reintenta)', async () => {
    mocks.preapproval.get.mockRejectedValue(new Error('MP API down'));
    const req = makeSignedRequest(
      { type: 'subscription_preapproval', data: { id: 'preapp_boom' } },
      { dataId: 'preapp_boom' },
    );
    const res = await POST(req);
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe('HANDLER_ERROR');
  });
});
