import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSession, mockDb, mockTransaction, mockRoles } = vi.hoisted(() => {
  const mockSession = {
    userId: 1,
    tenantId: 1,
    roles: ['admin'],
    nombre: 'Admin',
    email: 'admin@test.com',
    areaId: 1,
  };
  const mockDb = {
    usuarios: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
    areas: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    roles: { findMany: vi.fn() },
    usuarios_roles: { createMany: vi.fn() },
  };
  const mockTransaction = vi.fn().mockImplementation(async (cb: any) => {
    const tx = {
      usuarios: {
        create: vi
          .fn()
          .mockResolvedValue({ id: 10, tenant_id: 1, nombre: 'New User', email: 'new@test.com' }),
      },
      usuarios_roles: { createMany: vi.fn() },
      areas: { update: vi.fn() },
    };
    return cb(tx);
  });
  const mockRoles = vi.fn().mockResolvedValue([{ id: 1, nombre: 'solicitante' }]);
  return { mockSession, mockDb, mockTransaction, mockRoles };
});

vi.mock('@/lib/auth', () => ({ getServerSession: vi.fn().mockResolvedValue(mockSession) }));
vi.mock('@/lib/prisma', () => ({
  prisma: { ...mockDb, $transaction: mockTransaction, roles: { findMany: mockRoles } },
  tenantPrisma: vi.fn(() => mockDb),
}));
vi.mock('@/lib/permissions', () => ({
  verificarRol: vi.fn().mockReturnValue(true),
  verificarSegregacion: vi.fn().mockReturnValue({ permitido: true }),
  verificarResponsableDeArea: vi.fn().mockResolvedValue(true),
  apiError: vi.fn(
    (code: string, msg: string, status: number, details?: any) =>
      new Response(JSON.stringify({ error: { code, message: msg, details } }), { status }),
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
vi.mock('@/lib/plan-limits', () => ({
  canAssignRole: vi
    .fn()
    .mockResolvedValue({ allowed: true, count: 0, limit: 1, code: 'OK', message: '' }),
}));
vi.mock('@/types', () => ({ default: {} }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('hashed_pw') } }));

import { GET, POST } from '@/app/api/usuarios/route';

describe('GET /api/usuarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated users', async () => {
    const users = [
      {
        id: 1,
        nombre: 'Test',
        email: 'test@test.com',
        password_hash: 'secret',
        area: { id: 1, nombre: 'A' },
        usuarios_roles: [],
      },
    ];
    mockDb.usuarios.findMany.mockResolvedValue(users);
    mockDb.usuarios.count.mockResolvedValue(1);
    const req = new Request('http://localhost/api/usuarios');
    const res = await GET(req, {});
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.total).toBe(1);
  });
});

describe('POST /api/usuarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a user', async () => {
    mockDb.usuarios.findFirst.mockResolvedValue(null);
    mockDb.areas.findFirst.mockResolvedValue({ id: 1, activo: true });
    const req = new Request('http://localhost/api/usuarios', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'New User',
        email: 'new@test.com',
        password: 'Password1!@',
        area_id: 1,
        roles: ['solicitante'],
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, {});
    expect(res.status).toBe(201);
  });
});
