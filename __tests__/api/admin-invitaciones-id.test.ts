import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSession, mockPrisma } = vi.hoisted(() => {
  const mockSession = {
    userId: 1,
    tenantId: 1,
    roles: ['admin'] as string[],
    nombre: 'Admin',
    email: 'admin@test.com',
  };
  const mockPrisma = {
    codigos_invitacion: { findFirst: vi.fn(), update: vi.fn() },
  };
  return { mockSession, mockPrisma };
});

vi.mock('@/lib/auth', () => ({ getServerSession: vi.fn().mockResolvedValue(mockSession) }));
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/permissions', () => ({
  verificarRol: (roles: string[], required: string[]) => required.some((r) => roles.includes(r)),
  apiError: (code: string, msg: string, status: number) =>
    new Response(JSON.stringify({ error: { code, message: msg } }), { status }),
}));

import { PATCH } from '@/app/api/admin/invitaciones/[id]/route';

const patchReq = (id: string) =>
  PATCH(
    new Request(`http://localhost/api/admin/invitaciones/${id}`, { method: 'PATCH' }) as never,
    {
      params: Promise.resolve({ id }),
    },
  );

describe('PATCH /api/admin/invitaciones/[id] — tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.roles = ['admin'];
    mockSession.tenantId = 1;
  });

  it('scopes the lookup to the caller tenant for admin/director', async () => {
    // El código existe pero pertenece a otro tenant → el findFirst tenant-scoped
    // no lo encuentra → 404, nunca se llega al update (fix del IDOR).
    mockPrisma.codigos_invitacion.findFirst.mockResolvedValue(null);
    const res = await patchReq('99');
    expect(res.status).toBe(404);
    expect(mockPrisma.codigos_invitacion.findFirst).toHaveBeenCalledWith({
      where: { id: 99, tenant_id: 1 },
    });
    expect(mockPrisma.codigos_invitacion.update).not.toHaveBeenCalled();
  });

  it('toggles a code of the own tenant', async () => {
    mockPrisma.codigos_invitacion.findFirst.mockResolvedValue({ id: 5, activo: true });
    mockPrisma.codigos_invitacion.update.mockResolvedValue({ id: 5, activo: false });
    const res = await patchReq('5');
    expect(res.status).toBe(200);
    expect(mockPrisma.codigos_invitacion.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { activo: false },
    });
  });

  it('lets super_admin operate cross-tenant (no tenant filter)', async () => {
    mockSession.roles = ['super_admin'];
    mockPrisma.codigos_invitacion.findFirst.mockResolvedValue({ id: 7, activo: false });
    mockPrisma.codigos_invitacion.update.mockResolvedValue({ id: 7, activo: true });
    const res = await patchReq('7');
    expect(res.status).toBe(200);
    expect(mockPrisma.codigos_invitacion.findFirst).toHaveBeenCalledWith({
      where: { id: 7 },
    });
  });

  it('rejects roles without permission', async () => {
    mockSession.roles = ['solicitante'];
    const res = await patchReq('5');
    expect(res.status).toBe(403);
    expect(mockPrisma.codigos_invitacion.findFirst).not.toHaveBeenCalled();
  });
});
