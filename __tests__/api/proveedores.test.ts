import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSession, mockDb } = vi.hoisted(() => {
  const mockSession = { userId: 1, tenantId: 1, roles: ['compras'], nombre: 'Compras', email: 'comp@test.com', areaId: 1 };
  const mockDb = {
    proveedores: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
  return { mockSession, mockDb };
});

vi.mock('@/lib/auth', () => ({ getServerSession: vi.fn().mockResolvedValue(mockSession) }));
vi.mock('@/lib/prisma', () => ({ prisma: mockDb, tenantPrisma: vi.fn(() => mockDb) }));
vi.mock('@/lib/permissions', () => ({
  verificarRol: vi.fn().mockReturnValue(true),
  verificarSegregacion: vi.fn().mockReturnValue({ permitido: true }),
  verificarResponsableDeArea: vi.fn().mockResolvedValue(true),
  apiError: vi.fn((code: string, msg: string, status: number, details?: any) => new Response(JSON.stringify({ error: { code, message: msg, details } }), { status })),
  isOnlyResponsable: vi.fn().mockReturnValue(false),
}));
vi.mock('@/lib/audit', () => ({ registrarAuditoria: vi.fn(), getClientIp: vi.fn(() => '1.2.3.4') }));
vi.mock('@/lib/notifications', () => ({ crearNotificacion: vi.fn(), notificarPorRol: vi.fn(), notificarAdmins: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logApiError: vi.fn() }));
vi.mock('@/lib/tenant-override', () => ({ getEffectiveTenantId: vi.fn().mockResolvedValue({ session: mockSession, effectiveTenantId: 1 }) }));
vi.mock('@/lib/tenant-config', () => ({ getTenantConfigBool: vi.fn().mockResolvedValue(true), getTenantConfigNumber: vi.fn().mockResolvedValue(0) }));
vi.mock('@/lib/validators', async () => await vi.importActual('@/lib/validators'));
vi.mock('@/types', () => ({ default: {} }));

import { GET, POST } from '@/app/api/proveedores/route';

describe('GET /api/proveedores', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns list of proveedores', async () => {
    const provs = [{ id: 1, nombre: 'Prov A', activo: true }];
    mockDb.proveedores.findMany.mockResolvedValue(provs);
    const req = new Request('http://localhost/api/proveedores');
    const res = await GET(req, {});
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(provs);
  });
});

describe('POST /api/proveedores', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a proveedor', async () => {
    mockDb.proveedores.findFirst.mockResolvedValue(null);
    mockDb.proveedores.create.mockResolvedValue({ id: 1, nombre: 'Nuevo Prov', cuit: null });
    const req = new Request('http://localhost/api/proveedores', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Nuevo Prov' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, {});
    expect(res.status).toBe(201);
  });

  it('returns 409 for duplicate CUIT', async () => {
    mockDb.proveedores.findFirst.mockResolvedValue({ id: 2, nombre: 'Existente', cuit: '20-12345678-9' });
    const req = new Request('http://localhost/api/proveedores', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Otro Prov', cuit: '20-12345678-9' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, {});
    expect(res.status).toBe(409);
  });
});
