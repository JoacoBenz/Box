import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSession, mockDb } = vi.hoisted(() => {
  const mockSession = {
    userId: 1,
    tenantId: 1,
    roles: ['compras'],
    nombre: 'Compras',
    email: 'comp@test.com',
    areaId: 1,
  };
  const mockDb = {
    solicitudes: { findFirst: vi.fn(), update: vi.fn() },
  };
  return { mockSession, mockDb };
});

vi.mock('@/lib/auth', () => ({ getServerSession: vi.fn().mockResolvedValue(mockSession) }));
vi.mock('@/lib/prisma', () => ({ prisma: mockDb, tenantPrisma: vi.fn(() => mockDb) }));
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
vi.mock('@/types', () => ({ default: {} }));

import { POST } from '@/app/api/solicitudes/[id]/procesar-compras/route';

const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 7);
const futureDateStr = futureDate.toISOString().slice(0, 10);

function makeReq(body: any) {
  return new Request('http://localhost/api/solicitudes/1/procesar-compras', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/solicitudes/[id]/procesar-compras', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions en_compras → pago_programado', async () => {
    mockDb.solicitudes.findFirst.mockResolvedValue({
      id: 1,
      estado: 'en_compras',
      solicitante_id: 2,
      area_id: 1,
      titulo: 'Test',
      updated_at: new Date(),
    });
    mockDb.solicitudes.update.mockResolvedValue({});
    const res = await POST(
      makeReq({ prioridad_compra: 'normal', dia_pago_programado: futureDateStr }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(res.status).toBe(200);
    expect(mockDb.solicitudes.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'pago_programado' }) }),
    );
  });

  it('returns 400 for wrong state', async () => {
    mockDb.solicitudes.findFirst.mockResolvedValue({
      id: 1,
      estado: 'enviada',
      solicitante_id: 2,
      area_id: 1,
      titulo: 'Test',
      updated_at: new Date(),
    });
    const res = await POST(
      makeReq({ prioridad_compra: 'normal', dia_pago_programado: futureDateStr }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(res.status).toBe(400);
  });
});
