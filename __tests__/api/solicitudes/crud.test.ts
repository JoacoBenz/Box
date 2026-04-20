import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSession, mockDb, mockTransaction } = vi.hoisted(() => {
  const mockSession = {
    userId: 1,
    tenantId: 1,
    roles: ['solicitante'],
    nombre: 'Solicitante',
    email: 'sol@test.com',
    areaId: 1,
  };
  const mockDb = {
    solicitudes: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    areas: { findMany: vi.fn(), findFirst: vi.fn() },
    items_solicitud: { createMany: vi.fn(), deleteMany: vi.fn() },
    archivos: { findMany: vi.fn() },
  };
  const mockTransaction = vi.fn().mockImplementation(async (cb: any) => {
    const tx = {
      solicitudes: {
        create: vi
          .fn()
          .mockResolvedValue({ id: 1, numero: 'SC-2026-0001', titulo: 'Test', estado: 'borrador' }),
      },
      items_solicitud: { createMany: vi.fn() },
    };
    return cb(tx);
  });
  return { mockSession, mockDb, mockTransaction };
});

vi.mock('@/lib/auth', () => ({ getServerSession: vi.fn().mockResolvedValue(mockSession) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    ...mockDb,
    $transaction: mockTransaction,
    $queryRaw: vi.fn().mockResolvedValue([]),
    areas: { findFirst: vi.fn().mockResolvedValue({ responsable_id: 2 }) },
    solicitudes: { update: vi.fn() },
  },
  tenantPrisma: vi.fn(() => mockDb),
}));
vi.mock('@/lib/permissions', () => ({
  verificarRol: vi.fn().mockReturnValue(true),
  verificarSegregacion: vi.fn().mockReturnValue({ permitido: true }),
  verificarResponsableDeArea: vi.fn().mockResolvedValue(false),
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
vi.mock('@/types', () => ({ default: {} }));

import { GET, POST } from '@/app/api/solicitudes/route';

describe('GET /api/solicitudes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated list', async () => {
    const data = [{ id: 1, titulo: 'Test', estado: 'borrador' }];
    mockDb.solicitudes.findMany.mockResolvedValue(data);
    mockDb.solicitudes.count.mockResolvedValue(1);
    const req = new Request('http://localhost/api/solicitudes');
    const res = await GET(req, {});
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(data);
    expect(json.total).toBe(1);
    expect(json.page).toBe(1);
  });
});

describe('POST /api/solicitudes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates solicitud in borrador', async () => {
    const req = new Request('http://localhost/api/solicitudes', {
      method: 'POST',
      body: JSON.stringify({
        titulo: 'Necesito marcadores',
        descripcion: 'Necesitamos 50 marcadores para las aulas del primer piso',
        justificacion: 'Los marcadores actuales se agotaron y necesitamos reponer',
        urgencia: 'normal',
        items: [{ descripcion: 'Marcadores negros', cantidad: 50 }],
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, {});
    expect(res.status).toBe(201);
  });
});
