import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSession, mockPrisma } = vi.hoisted(() => {
  const mockSession = {
    userId: 1,
    tenantId: 1,
    roles: ['solicitante'],
    nombre: 'Test',
    email: 'test@test.com',
    areaId: 1,
  };
  const mockPrisma = {
    usuarios: { findUnique: vi.fn(), update: vi.fn() },
  };
  return { mockSession, mockPrisma };
});

vi.mock('@/lib/auth', () => ({ getServerSession: vi.fn().mockResolvedValue(mockSession) }));
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, tenantPrisma: vi.fn(() => mockPrisma) }));
vi.mock('@/lib/permissions', () => ({
  verificarRol: vi.fn().mockReturnValue(true),
  verificarSegregacion: vi.fn().mockReturnValue({ permitido: true }),
  verificarResponsableDeArea: vi.fn().mockResolvedValue(true),
  apiError: vi.fn(
    (code: string, msg: string, status: number) =>
      new Response(JSON.stringify({ error: { code, message: msg } }), { status }),
  ),
  isOnlyResponsable: vi.fn().mockReturnValue(false),
}));
vi.mock('@/lib/audit', () => ({
  registrarAuditoria: vi.fn(),
  getClientIp: vi.fn(() => '1.2.3.4'),
}));
vi.mock('@/lib/notifications', () => ({
  crearNotificacion: vi.fn(),
  notificarPorRol: vi.fn(),
  notificarAdmins: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({ logApiError: vi.fn() }));
vi.mock('@/lib/tenant-override', () => ({
  getEffectiveTenantId: vi.fn().mockResolvedValue({ session: mockSession, effectiveTenantId: 1 }),
}));
vi.mock('@/lib/tenant-config', () => ({
  getTenantConfigBool: vi.fn().mockResolvedValue(true),
  getTenantConfigNumber: vi.fn().mockResolvedValue(0),
}));
vi.mock('@/lib/validators', async () => await vi.importActual('@/lib/validators'));
vi.mock('@/types', () => ({ default: {} }));
vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn().mockResolvedValue(true), hash: vi.fn().mockResolvedValue('hashed') },
}));

import { GET, PATCH } from '@/app/api/auth/profile/route';

describe('GET /api/auth/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user profile', async () => {
    mockPrisma.usuarios.findUnique.mockResolvedValue({
      id: 1,
      nombre: 'Test',
      email: 'test@test.com',
      password_hash: 'hash',
      area: { nombre: 'Area 1' },
      tenant: { nombre: 'Org 1' },
      usuarios_roles: [{ rol: { nombre: 'solicitante' } }],
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.nombre).toBe('Test');
    expect(json.tienePassword).toBe(true);
  });
});

describe('PATCH /api/auth/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates nombre', async () => {
    mockPrisma.usuarios.update.mockResolvedValue({});
    const req = new Request('http://localhost/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ nombre: 'Nuevo Nombre' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req as any);
    expect(res.status).toBe(200);
    expect(mockPrisma.usuarios.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { nombre: 'Nuevo Nombre' } }),
    );
  });

  it('rejects password change for SSO user (no password_hash, not admin)', async () => {
    mockPrisma.usuarios.findUnique.mockResolvedValue({
      id: 1,
      password_hash: null,
      usuarios_roles: [{ rol: { nombre: 'solicitante' } }],
    });
    const req = new Request('http://localhost/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ passwordNuevo: 'NewPassword1!' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req as any);
    expect(res.status).toBe(400);
  });
});
