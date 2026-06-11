import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSession, mockDb } = vi.hoisted(() => {
  const mockSession = {
    userId: 1,
    tenantId: 1,
    roles: ['director'],
    nombre: 'Director',
    email: 'dir@test.com',
    areaId: 1,
  };
  const mockDb = {
    solicitudes: { findFirst: vi.fn(), update: vi.fn() },
    areas: { findFirst: vi.fn() },
  };
  return { mockSession, mockDb };
});

vi.mock('@/lib/auth', () => ({ getServerSession: vi.fn().mockResolvedValue(mockSession) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    areas: { findFirst: vi.fn().mockResolvedValue(null) },
    roles: { findUnique: vi.fn().mockResolvedValue(null) },
    usuarios_roles: { count: vi.fn().mockResolvedValue(0) },
  },
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
  notificarResponsableArea: vi.fn(),
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
vi.mock('@/lib/approval-limits', () => ({
  canUserApproveAmount: vi.fn().mockResolvedValue({ allowed: true, requiredLevel: 'director' }),
}));
vi.mock('@/lib/budget-control', () => ({
  verificarPresupuesto: vi.fn().mockResolvedValue({
    status: { excedido: false, centroCosto: 'Test', alertaPorcentaje: 50 },
  }),
}));

import { POST } from '@/app/api/solicitudes/aprobar-masivo/route';

function makeReq(body: any) {
  return new Request('http://localhost/api/solicitudes/aprobar-masivo', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const makeSolicitud = (id: number, estado = 'validada') => ({
  id,
  estado,
  solicitante_id: 2,
  area_id: 1,
  titulo: `Test ${id}`,
  numero: `SOL-${id}`,
  centro_costo_id: null,
  validado_por_id: null,
  updated_at: new Date(),
  items_solicitud: [{ precio_estimado: 100, cantidad: 1 }],
});

describe('POST /api/solicitudes/aprobar-masivo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approves multiple solicitudes', async () => {
    mockDb.solicitudes.findFirst
      .mockResolvedValueOnce(makeSolicitud(1))
      .mockResolvedValueOnce(makeSolicitud(2));
    mockDb.solicitudes.update.mockResolvedValue({});

    const res = await POST(makeReq({ ids: [1, 2] }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.aprobadas).toBe(2);
    expect(json.errores).toHaveLength(0);
    expect(mockDb.solicitudes.update).toHaveBeenCalledTimes(2);
  });

  it('returns 400 for empty array', async () => {
    const res = await POST(makeReq({ ids: [] }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when ids is missing', async () => {
    const res = await POST(makeReq({}), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
  });

  it('reports errors for solicitudes in wrong state', async () => {
    mockDb.solicitudes.findFirst
      .mockResolvedValueOnce(makeSolicitud(1, 'validada'))
      .mockResolvedValueOnce(makeSolicitud(2, 'borrador'));
    mockDb.solicitudes.update.mockResolvedValue({});

    const res = await POST(makeReq({ ids: [1, 2] }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.aprobadas).toBe(1);
    expect(json.errores).toHaveLength(1);
    expect(json.errores[0].id).toBe(2);
  });

  it('reports error for missing solicitud', async () => {
    mockDb.solicitudes.findFirst
      .mockResolvedValueOnce(makeSolicitud(1))
      .mockResolvedValueOnce(null);
    mockDb.solicitudes.update.mockResolvedValue({});

    const res = await POST(makeReq({ ids: [1, 2] }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.aprobadas).toBe(1);
    expect(json.errores).toHaveLength(1);
    expect(json.errores[0].id).toBe(2);
    expect(json.errores[0].error).toBe('No encontrada');
  });

  it('returns 400 for invalid IDs (non-numeric)', async () => {
    const res = await POST(makeReq({ ids: ['abc', -1, 0] }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
  });
});
