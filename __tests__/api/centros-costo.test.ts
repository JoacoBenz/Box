import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSession, mockDb } = vi.hoisted(() => {
  const mockSession = { userId: 1, tenantId: 1, roles: ['admin'], nombre: 'Admin', email: 'admin@test.com', areaId: 1 };
  const mockDb = {
    centros_costo: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    areas: { findUnique: vi.fn(), findFirst: vi.fn() },
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

import { GET, POST } from '@/app/api/centros-costo/route';

describe('GET /api/centros-costo', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns list of centros', async () => {
    const centros = [{ id: 1, nombre: 'Centro A', codigo: 'CA', activo: true }];
    mockDb.centros_costo.findMany.mockResolvedValue(centros);
    const req = new Request('http://localhost/api/centros-costo');
    const res = await GET(req, {});
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(centros);
  });
});

describe('POST /api/centros-costo', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a centro de costo', async () => {
    mockDb.centros_costo.findFirst.mockResolvedValue(null);
    mockDb.areas.findUnique.mockResolvedValue({ presupuesto_anual: 1000000, presupuesto_mensual: 100000 });
    mockDb.centros_costo.findMany.mockResolvedValue([]);
    mockDb.centros_costo.create.mockResolvedValue({ id: 1, nombre: 'Nuevo', codigo: 'NV', area_id: 1 });
    const req = new Request('http://localhost/api/centros-costo', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Nuevo', codigo: 'NV', area_id: 1, presupuesto_anual: 50000 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, {});
    expect(res.status).toBe(201);
  });

  it('returns 400 when budget exceeds area', async () => {
    mockDb.centros_costo.findFirst.mockResolvedValue(null);
    mockDb.areas.findUnique.mockResolvedValue({ presupuesto_anual: 100000, presupuesto_mensual: null });
    mockDb.centros_costo.findMany.mockResolvedValue([{ presupuesto_anual: 90000, presupuesto_mensual: 0 }]);
    const req = new Request('http://localhost/api/centros-costo', {
      method: 'POST',
      body: JSON.stringify({ nombre: 'Excede', codigo: 'EX', area_id: 1, presupuesto_anual: 20000 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, {});
    expect(res.status).toBe(400);
  });
});
