import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSession, mockDb } = vi.hoisted(() => {
  const mockSession = { userId: 1, tenantId: 1, roles: ['director'], nombre: 'Director', email: 'dir@test.com', areaId: 1 };
  const mockDb = {
    solicitudes: { findMany: vi.fn() },
  };
  return { mockSession, mockDb };
});

vi.mock('@/lib/auth', () => ({ getServerSession: vi.fn().mockResolvedValue(mockSession) }));
vi.mock('@/lib/prisma', () => ({ prisma: mockDb, tenantPrisma: vi.fn(() => mockDb) }));
vi.mock('@/lib/permissions', () => ({
  verificarRol: vi.fn().mockReturnValue(true),
  verificarSegregacion: vi.fn().mockReturnValue({ permitido: true }),
  verificarResponsableDeArea: vi.fn().mockResolvedValue(true),
  apiError: vi.fn((code: string, msg: string, status: number) => new Response(JSON.stringify({ error: { code, message: msg } }), { status })),
  isOnlyResponsable: vi.fn().mockReturnValue(false),
}));
vi.mock('@/lib/audit', () => ({ registrarAuditoria: vi.fn(), getClientIp: vi.fn(() => '1.2.3.4') }));
vi.mock('@/lib/notifications', () => ({ crearNotificacion: vi.fn(), notificarPorRol: vi.fn(), notificarAdmins: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logApiError: vi.fn() }));
vi.mock('@/lib/tenant-override', () => ({ getEffectiveTenantId: vi.fn().mockResolvedValue({ session: mockSession, effectiveTenantId: 1 }) }));
vi.mock('@/lib/tenant-config', () => ({ getTenantConfigBool: vi.fn().mockResolvedValue(true), getTenantConfigNumber: vi.fn().mockResolvedValue(0) }));
vi.mock('@/lib/validators', async () => await vi.importActual('@/lib/validators'));
vi.mock('@/types', () => ({ default: {} }));

import { GET } from '@/app/api/solicitudes/export/route';

describe('GET /api/solicitudes/export', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns xlsx buffer with correct content-type', async () => {
    mockDb.solicitudes.findMany.mockResolvedValue([
      { numero: 'SC-2026-0001', titulo: 'Test', estado: 'enviada', urgencia: 'normal', area: { nombre: 'Area 1' }, solicitante: { nombre: 'User' }, centro_costo: null, compras: [], created_at: new Date() },
    ]);
    const req = new Request('http://localhost/api/solicitudes/export');
    const res = await GET(req, {});
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('passes filters to query', async () => {
    mockDb.solicitudes.findMany.mockResolvedValue([]);
    const req = new Request('http://localhost/api/solicitudes/export?estado=enviada&area_id=2');
    const res = await GET(req, {});
    expect(res.status).toBe(200);
    expect(mockDb.solicitudes.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ estado: { in: ['enviada'] }, area_id: 2 }),
    }));
  });
});
