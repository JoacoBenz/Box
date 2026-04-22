import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  cookieGet: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: mocks.cookieGet }),
}));

import { getEffectiveTenantId, getServerTenantId } from '@/lib/tenant-override';

// ── Helpers ──

function makeSession(roles: string[], tenantId = 1) {
  return { tenantId, roles, userId: 10, email: 'u@test.com', nombre: 'Test' };
}

function makeRequest(tenantIdParam?: string): Request {
  const url = tenantIdParam
    ? `http://localhost/api/test?tenantId=${tenantIdParam}`
    : 'http://localhost/api/test';
  return new Request(url);
}

// ── Setup ──

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getServerSession.mockResolvedValue(makeSession(['admin']));
  mocks.cookieGet.mockReturnValue(undefined);
});

// ── getEffectiveTenantId ─────────────────────────────────────────────────────

describe('getEffectiveTenantId', () => {
  it('regular user always gets session.tenantId regardless of query params', async () => {
    mocks.getServerSession.mockResolvedValue(makeSession(['admin'], 5));
    const { effectiveTenantId } = await getEffectiveTenantId(makeRequest('99'));
    expect(effectiveTenantId).toBe(5);
  });

  it('regular user always gets session.tenantId regardless of cookie override', async () => {
    mocks.getServerSession.mockResolvedValue(makeSession(['solicitante'], 3));
    mocks.cookieGet.mockReturnValue({ value: '77' });
    const { effectiveTenantId } = await getEffectiveTenantId();
    expect(effectiveTenantId).toBe(3);
  });

  it('super_admin with query param override gets that tenant ID', async () => {
    mocks.getServerSession.mockResolvedValue(makeSession(['super_admin']));
    const { effectiveTenantId } = await getEffectiveTenantId(makeRequest('42'));
    expect(effectiveTenantId).toBe(42);
  });

  it('super_admin with cookie override gets that tenant ID', async () => {
    mocks.getServerSession.mockResolvedValue(makeSession(['super_admin']));
    mocks.cookieGet.mockReturnValue({ value: '88' });
    const { effectiveTenantId } = await getEffectiveTenantId();
    expect(effectiveTenantId).toBe(88);
  });

  it('super_admin query param takes precedence over cookie', async () => {
    mocks.getServerSession.mockResolvedValue(makeSession(['super_admin']));
    mocks.cookieGet.mockReturnValue({ value: '88' });
    const { effectiveTenantId } = await getEffectiveTenantId(makeRequest('55'));
    expect(effectiveTenantId).toBe(55);
  });

  it('super_admin with no override gets null', async () => {
    mocks.getServerSession.mockResolvedValue(makeSession(['super_admin']));
    const { effectiveTenantId } = await getEffectiveTenantId();
    expect(effectiveTenantId).toBeNull();
  });
});

// ── getServerTenantId ────────────────────────────────────────────────────────

describe('getServerTenantId', () => {
  it('regular user returns session.tenantId', async () => {
    const result = await getServerTenantId({ tenantId: 7, roles: ['admin'] });
    expect(result).toBe(7);
  });

  it('super_admin with cookie returns cookie value', async () => {
    mocks.cookieGet.mockReturnValue({ value: '33' });
    const result = await getServerTenantId({ tenantId: 1, roles: ['super_admin'] });
    expect(result).toBe(33);
  });

  it('super_admin without cookie returns null', async () => {
    const result = await getServerTenantId({ tenantId: 1, roles: ['super_admin'] });
    expect(result).toBeNull();
  });
});
