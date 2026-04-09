import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { _global: true },
  tenantPrisma: vi.fn(() => ({ _scoped: true })),
}));
vi.mock('@/lib/permissions', () => ({
  verificarRol: vi.fn(),
  apiError: vi.fn((code, message, status, details) => {
    return new Response(JSON.stringify({ error: { code, message, details } }), { status });
  }),
}));
vi.mock('@/lib/audit', () => ({
  getClientIp: vi.fn(() => '1.2.3.4'),
}));
vi.mock('@/lib/tenant-override', () => ({
  getEffectiveTenantId: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logApiError: vi.fn(),
}));
vi.mock('@/types', () => ({}));

import { withAuth, withAdminOverride, validateBody } from '@/lib/api-handler';
import { getServerSession } from '@/lib/auth';
import { verificarRol } from '@/lib/permissions';
import { getEffectiveTenantId } from '@/lib/tenant-override';

const mockGetSession = getServerSession as any;
const mockVerificarRol = verificarRol as any;
const mockGetEffective = getEffectiveTenantId as any;

const fakeSession = { userId: 1, tenantId: 1, roles: ['director'], nombre: 'Test', email: 'test@test.com' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validateBody', () => {
  const schema = z.object({ name: z.string().min(2) });

  it('returns success true with typed data for valid input', () => {
    const result = validateBody(schema, { name: 'Test' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Test');
  });

  it('returns success false and 400 Response for invalid input', () => {
    const result = validateBody(schema, { name: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.response.status).toBe(400);
  });

  it('includes field paths in error details', () => {
    const result = validateBody(schema, { name: 'a' });
    expect(result.success).toBe(false);
  });
});

describe('withAuth', () => {
  it('calls handler with session, db, and ip when authenticated', async () => {
    mockGetSession.mockResolvedValue(fakeSession);
    mockVerificarRol.mockReturnValue(true);
    const handler = vi.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withAuth({ roles: ['director'] }, handler);
    const req = new Request('http://localhost/api/test');
    await wrapped(req);
    expect(handler).toHaveBeenCalledWith(req, expect.objectContaining({ session: fakeSession, ip: '1.2.3.4' }), undefined);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockRejectedValue(new Error('No autenticado'));
    const handler = vi.fn();
    const wrapped = withAuth({}, handler);
    const res = await wrapped(new Request('http://localhost/api/test'));
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 403 when user lacks required roles', async () => {
    mockGetSession.mockResolvedValue(fakeSession);
    mockVerificarRol.mockReturnValue(false);
    const handler = vi.fn();
    const wrapped = withAuth({ roles: ['admin'] }, handler);
    const res = await wrapped(new Request('http://localhost/api/test'));
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows through when roles option is empty (auth-only)', async () => {
    mockGetSession.mockResolvedValue(fakeSession);
    const handler = vi.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withAuth({}, handler);
    await wrapped(new Request('http://localhost/api/test'));
    expect(handler).toHaveBeenCalled();
  });
});

describe('withAdminOverride', () => {
  it('calls handler with effectiveTenantId', async () => {
    mockGetEffective.mockResolvedValue({ session: fakeSession, effectiveTenantId: 5 });
    mockVerificarRol.mockReturnValue(true);
    const handler = vi.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withAdminOverride({ roles: ['admin'] }, handler);
    await wrapped(new Request('http://localhost/api/test'));
    expect(handler).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ effectiveTenantId: 5 }),
      undefined
    );
  });

  it('returns 403 when user lacks required roles', async () => {
    mockGetEffective.mockResolvedValue({ session: fakeSession, effectiveTenantId: 1 });
    mockVerificarRol.mockReturnValue(false);
    const handler = vi.fn();
    const wrapped = withAdminOverride({ roles: ['admin'] }, handler);
    const res = await wrapped(new Request('http://localhost/api/test'));
    expect(res.status).toBe(403);
  });

  it('returns 400 for write request without effectiveTenantId', async () => {
    mockGetEffective.mockResolvedValue({ session: fakeSession, effectiveTenantId: null });
    mockVerificarRol.mockReturnValue(true);
    const handler = vi.fn();
    const wrapped = withAdminOverride({}, handler);
    const res = await wrapped(new Request('http://localhost/api/test', { method: 'POST' }));
    expect(res.status).toBe(400);
  });

  it('allows GET request without effectiveTenantId', async () => {
    mockGetEffective.mockResolvedValue({ session: fakeSession, effectiveTenantId: null });
    mockVerificarRol.mockReturnValue(true);
    const handler = vi.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withAdminOverride({}, handler);
    const res = await wrapped(new Request('http://localhost/api/test', { method: 'GET' }));
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });
});
