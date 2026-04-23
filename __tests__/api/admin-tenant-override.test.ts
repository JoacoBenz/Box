import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mocks.cookieGet,
    set: mocks.cookieSet,
    delete: mocks.cookieDelete,
  }),
}));

import { GET, POST } from '@/app/api/admin/tenant-override/route';

function superAdminSession() {
  return {
    userId: 1,
    tenantId: 3,
    roles: ['super_admin'],
    nombre: 'Super',
    email: 'super@box.com',
  };
}

function regularAdminSession() {
  return {
    userId: 2,
    tenantId: 1,
    roles: ['admin'],
    nombre: 'Admin',
    email: 'admin@box.com',
  };
}

function postReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/tenant-override', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookieGet.mockReturnValue(undefined);
});

describe('GET /api/admin/tenant-override', () => {
  it('returns null tenantId for non-super_admin users (never leaks the cookie)', async () => {
    mocks.getServerSession.mockResolvedValue(regularAdminSession());
    mocks.cookieGet.mockReturnValue({ value: '42' });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tenantId: null });
  });

  it('returns null when no cookie is set', async () => {
    mocks.getServerSession.mockResolvedValue(superAdminSession());
    mocks.cookieGet.mockReturnValue(undefined);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tenantId: null });
  });

  it('returns the stored tenantId as a number for super_admin', async () => {
    mocks.getServerSession.mockResolvedValue(superAdminSession());
    mocks.cookieGet.mockReturnValue({ value: '42' });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tenantId: 42 });
  });

  it('returns null when the cookie is garbage (non-numeric)', async () => {
    mocks.getServerSession.mockResolvedValue(superAdminSession());
    mocks.cookieGet.mockReturnValue({ value: 'not-a-number' });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tenantId: null });
  });

  it('returns null when the cookie is zero or negative', async () => {
    mocks.getServerSession.mockResolvedValue(superAdminSession());
    mocks.cookieGet.mockReturnValue({ value: '0' });
    const res = await GET();
    expect(await res.json()).toEqual({ tenantId: null });

    mocks.cookieGet.mockReturnValue({ value: '-5' });
    const res2 = await GET();
    expect(await res2.json()).toEqual({ tenantId: null });
  });

  it('returns 401 when not authenticated', async () => {
    mocks.getServerSession.mockRejectedValue(new Error('No autenticado'));
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/tenant-override', () => {
  it('rejects non-super_admin with 403', async () => {
    mocks.getServerSession.mockResolvedValue(regularAdminSession());
    const res = await POST(postReq({ tenantId: 5 }));
    expect(res.status).toBe(403);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads with 400 (negative)', async () => {
    mocks.getServerSession.mockResolvedValue(superAdminSession());
    const res = await POST(postReq({ tenantId: -1 }));
    expect(res.status).toBe(400);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads with 400 (string)', async () => {
    mocks.getServerSession.mockResolvedValue(superAdminSession());
    const res = await POST(postReq({ tenantId: 'abc' }));
    expect(res.status).toBe(400);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads with 400 (non-integer)', async () => {
    mocks.getServerSession.mockResolvedValue(superAdminSession());
    const res = await POST(postReq({ tenantId: 1.5 }));
    expect(res.status).toBe(400);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('sets cookie with httpOnly + sameSite lax for valid tenantId', async () => {
    mocks.getServerSession.mockResolvedValue(superAdminSession());
    const res = await POST(postReq({ tenantId: 42 }));
    expect(res.status).toBe(200);
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'admin_tenant_id',
      '42',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      }),
    );
  });

  it('deletes cookie when tenantId is null', async () => {
    mocks.getServerSession.mockResolvedValue(superAdminSession());
    const res = await POST(postReq({ tenantId: null }));
    expect(res.status).toBe(200);
    expect(mocks.cookieDelete).toHaveBeenCalledWith('admin_tenant_id');
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('deletes cookie when tenantId is omitted', async () => {
    mocks.getServerSession.mockResolvedValue(superAdminSession());
    const res = await POST(postReq({}));
    expect(res.status).toBe(200);
    expect(mocks.cookieDelete).toHaveBeenCalledWith('admin_tenant_id');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.getServerSession.mockRejectedValue(new Error('No autenticado'));
    const res = await POST(postReq({ tenantId: 1 }));
    expect(res.status).toBe(401);
  });
});
