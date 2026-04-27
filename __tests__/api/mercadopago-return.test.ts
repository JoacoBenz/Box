import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  const session = {
    userId: 1,
    tenantId: 9,
    roles: ['admin'] as string[],
    nombre: 'Admin Test',
    email: 'admin@joaco.test',
  };
  const preapprovalGet = vi.fn();
  return {
    session,
    getServerSession: vi.fn().mockResolvedValue(session),
    isMpEnabled: vi.fn().mockReturnValue(true),
    preapprovalGet,
    getPreApproval: vi.fn(() => ({ get: preapprovalGet })),
    attachMpPreapprovalToTenant: vi.fn(),
  };
});

vi.mock('@/lib/auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/mercadopago', () => ({
  isMpEnabled: mocks.isMpEnabled,
  getPreApproval: mocks.getPreApproval,
}));
vi.mock('@/lib/subscription', () => ({
  attachMpPreapprovalToTenant: mocks.attachMpPreapprovalToTenant,
}));
vi.mock('@/lib/logger', () => ({ logApiError: vi.fn() }));

import { GET } from '@/app/api/mercadopago/return/route';

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, NEXTAUTH_URL: 'https://app.test' };
  vi.clearAllMocks();
  mocks.isMpEnabled.mockReturnValue(true);
  mocks.getServerSession.mockResolvedValue(mocks.session);
  mocks.preapprovalGet.mockResolvedValue({
    id: 'preapp_real_123',
    status: 'authorized',
    payer_email: 'TESTUSER123@testuser.com',
    date_created: '2026-04-27T14:00:00Z',
    next_payment_date: '2026-05-27T14:00:00Z',
  });
});

function makeReq(query: string): NextRequest {
  return new NextRequest(`https://app.test/api/mercadopago/return${query}`);
}

describe('GET /api/mercadopago/return', () => {
  it('atacha la preapproval al tenant cuando MP devuelve authorized', async () => {
    const res = await GET(makeReq('?preapproval_id=preapp_real_123'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://app.test/perfil?tab=facturacion&checkout=success',
    );
    expect(mocks.attachMpPreapprovalToTenant).toHaveBeenCalledWith({
      tenantId: 9,
      mpPreapprovalId: 'preapp_real_123',
      payerEmail: 'TESTUSER123@testuser.com',
      currentPeriodStart: new Date('2026-04-27T14:00:00Z'),
      currentPeriodEnd: new Date('2026-05-27T14:00:00Z'),
    });
  });

  it('no atacha cuando MP devuelve status pending — webhook se encargará', async () => {
    mocks.preapprovalGet.mockResolvedValue({
      id: 'preapp_pending',
      status: 'pending',
      payer_email: null,
    });
    const res = await GET(makeReq('?preapproval_id=preapp_pending'));
    expect(res.status).toBe(307);
    expect(mocks.attachMpPreapprovalToTenant).not.toHaveBeenCalled();
  });

  it('redirige a checkout=cancelled si MP no manda preapproval_id', async () => {
    const res = await GET(makeReq(''));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('checkout=cancelled');
    expect(mocks.attachMpPreapprovalToTenant).not.toHaveBeenCalled();
  });

  it('si la sesión expiró, redirige a /login y deja el linking al webhook', async () => {
    mocks.getServerSession.mockRejectedValueOnce(new Error('No autenticado'));
    const res = await GET(makeReq('?preapproval_id=preapp_x'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
    expect(mocks.attachMpPreapprovalToTenant).not.toHaveBeenCalled();
  });

  it('no rompe el redirect si MP API falla — el webhook resuelve', async () => {
    mocks.preapprovalGet.mockRejectedValueOnce(new Error('mp api 500'));
    const res = await GET(makeReq('?preapproval_id=preapp_x'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'https://app.test/perfil?tab=facturacion&checkout=success',
    );
    expect(mocks.attachMpPreapprovalToTenant).not.toHaveBeenCalled();
  });
});
