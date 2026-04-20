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
  prisma: { areas: { findFirst: vi.fn().mockResolvedValue(null) } },
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
vi.mock('@/types', () => ({ default: {} }));

import { POST } from '@/app/api/solicitudes/[id]/rechazar/route';

function makeReq(body: any) {
  return new Request('http://localhost/api/solicitudes/1/rechazar', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/solicitudes/[id]/rechazar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions validada → rechazada with motivo', async () => {
    mockDb.solicitudes.findFirst.mockResolvedValue({
      id: 1,
      estado: 'validada',
      solicitante_id: 2,
      area_id: 1,
      titulo: 'Test',
      updated_at: new Date(),
    });
    mockDb.solicitudes.update.mockResolvedValue({});
    const res = await POST(makeReq({ motivo: 'No hay presupuesto disponible' }), {
      params: Promise.resolve({ id: '1' }),
    });
    expect(res.status).toBe(200);
    expect(mockDb.solicitudes.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'rechazada' }) }),
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
    const res = await POST(makeReq({ motivo: 'No hay presupuesto disponible' }), {
      params: Promise.resolve({ id: '1' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when motivo is missing', async () => {
    mockDb.solicitudes.findFirst.mockResolvedValue({
      id: 1,
      estado: 'validada',
      solicitante_id: 2,
      area_id: 1,
      titulo: 'Test',
      updated_at: new Date(),
    });
    const res = await POST(makeReq({}), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(400);
  });
});
