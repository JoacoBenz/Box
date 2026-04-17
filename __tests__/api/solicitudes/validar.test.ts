import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSession, mockDb } = vi.hoisted(() => {
  const mockSession = {
    userId: 1,
    tenantId: 1,
    roles: ['responsable_area'],
    nombre: 'Test User',
    email: 'test@test.com',
    areaId: 1,
  };
  const mockDb = {
    solicitudes: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
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

import { POST } from '@/app/api/solicitudes/[id]/validar/route';
import { verificarSegregacion } from '@/lib/permissions';

describe('POST /api/solicitudes/[id]/validar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions enviada → validada', async () => {
    mockDb.solicitudes.findFirst.mockResolvedValue({
      id: 1,
      estado: 'enviada',
      solicitante_id: 2,
      area_id: 1,
      titulo: 'Test',
      updated_at: new Date(),
    });
    mockDb.solicitudes.update.mockResolvedValue({});

    const req = new Request('http://localhost/api/solicitudes/1/validar', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe('Solicitud validada');
    expect(mockDb.solicitudes.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'validada' }) }),
    );
  });

  it('returns 404 when solicitud not found', async () => {
    mockDb.solicitudes.findFirst.mockResolvedValue(null);
    const req = new Request('http://localhost/api/solicitudes/999/validar', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: '999' }) });
    expect(res.status).toBe(404);
  });

  it('returns 400 for wrong state', async () => {
    mockDb.solicitudes.findFirst.mockResolvedValue({
      id: 1,
      estado: 'borrador',
      solicitante_id: 2,
      area_id: 1,
      titulo: 'Test',
      updated_at: new Date(),
    });
    const req = new Request('http://localhost/api/solicitudes/1/validar', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 403 on segregation failure', async () => {
    mockDb.solicitudes.findFirst.mockResolvedValue({
      id: 1,
      estado: 'enviada',
      solicitante_id: 2,
      area_id: 1,
      titulo: 'Test',
      updated_at: new Date(),
    });
    vi.mocked(verificarSegregacion).mockReturnValueOnce({
      permitido: false,
      motivo: 'No podés validar tu propia solicitud',
    });
    const req = new Request('http://localhost/api/solicitudes/1/validar', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(403);
  });
});
