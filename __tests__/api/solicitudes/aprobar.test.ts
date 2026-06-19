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
vi.mock('@/lib/optimistic-lock', () => ({
  checkOptimisticLock: vi.fn().mockReturnValue(null),
}));
vi.mock('@/lib/approval-limits', () => ({
  canUserApproveAmount: vi.fn().mockResolvedValue({ allowed: true, requiredLevel: 'director' }),
}));
vi.mock('@/lib/budget-control', () => ({
  verificarPresupuesto: vi.fn().mockResolvedValue({
    status: { excedido: false, centroCosto: 'Test', alertaPorcentaje: 50 },
  }),
  verificarPresupuestoArea: vi.fn().mockResolvedValue({
    permitido: true,
    status: { presupuestoMensual: null, presupuestoAnual: null, gastoMensual: 0, gastoAnual: 0 },
  }),
}));

import { POST } from '@/app/api/solicitudes/[id]/aprobar/route';

function makeReq(body: any) {
  return new Request('http://localhost/api/solicitudes/1/aprobar', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const baseSolicitud = {
  id: 1,
  estado: 'validada',
  solicitante_id: 2,
  area_id: 1,
  titulo: 'Test',
  numero: 'SOL-001',
  centro_costo_id: null,
  validado_por_id: null,
  updated_at: new Date(),
  items_solicitud: [{ precio_estimado: 100, cantidad: 2 }],
};

describe('POST /api/solicitudes/[id]/aprobar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions validada -> aprobada when no compras users exist', async () => {
    mockDb.solicitudes.findFirst.mockResolvedValue({ ...baseSolicitud });
    mockDb.solicitudes.update.mockResolvedValue({});
    const res = await POST(makeReq({}), {
      params: Promise.resolve({ id: '1' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe('Solicitud aprobada');
    expect(mockDb.solicitudes.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'aprobada' }),
      }),
    );
  });

  it('returns 400 for wrong state (borrador)', async () => {
    mockDb.solicitudes.findFirst.mockResolvedValue({
      ...baseSolicitud,
      estado: 'borrador',
    });
    const res = await POST(makeReq({}), {
      params: Promise.resolve({ id: '1' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for missing solicitud', async () => {
    mockDb.solicitudes.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({}), {
      params: Promise.resolve({ id: '1' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const res = await POST(makeReq({}), {
      params: Promise.resolve({ id: 'abc' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 403 when segregacion is not permitted', async () => {
    const { verificarSegregacion } = await import('@/lib/permissions');
    vi.mocked(verificarSegregacion).mockReturnValueOnce({
      permitido: false,
      motivo: 'No puede aprobar su propia solicitud',
    });
    mockDb.solicitudes.findFirst.mockResolvedValue({ ...baseSolicitud });
    const res = await POST(makeReq({}), {
      params: Promise.resolve({ id: '1' }),
    });
    expect(res.status).toBe(403);
  });
});
