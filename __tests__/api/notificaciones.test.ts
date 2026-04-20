import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSession, mockDb, mockPrismaGlobal } = vi.hoisted(() => {
  const mockSession = {
    userId: 1,
    tenantId: 1,
    roles: ['solicitante'],
    nombre: 'Test',
    email: 'test@test.com',
    areaId: 1,
  };
  const mockDb = {
    notificaciones: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const mockPrismaGlobal = {
    notificaciones: { updateMany: vi.fn() },
  };
  return { mockSession, mockDb, mockPrismaGlobal };
});

vi.mock('@/lib/auth', () => ({ getServerSession: vi.fn().mockResolvedValue(mockSession) }));
vi.mock('@/lib/prisma', () => ({ prisma: mockPrismaGlobal, tenantPrisma: vi.fn(() => mockDb) }));
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

import { GET } from '@/app/api/notificaciones/route';
import { GET as GETCount } from '@/app/api/notificaciones/count/route';
import { PATCH } from '@/app/api/notificaciones/[id]/route';
import { PATCH as PATCHAll } from '@/app/api/notificaciones/marcar-todas/route';

describe('GET /api/notificaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns notifications', async () => {
    const notifs = [{ id: 1, titulo: 'Test', leida: false }];
    mockDb.notificaciones.findMany.mockResolvedValue(notifs);
    const req = new Request('http://localhost/api/notificaciones');
    const res = await GET(req, {});
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(notifs);
  });
});

describe('GET /api/notificaciones/count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unread count', async () => {
    mockDb.notificaciones.count.mockResolvedValue(5);
    const req = new Request('http://localhost/api/notificaciones/count');
    const res = await GETCount(req, {});
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(5);
  });
});

describe('PATCH /api/notificaciones/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks notification as read', async () => {
    mockDb.notificaciones.findFirst.mockResolvedValue({
      id: 1,
      usuario_destino_id: 1,
      leida: false,
    });
    mockDb.notificaciones.update.mockResolvedValue({});
    const req = new Request('http://localhost/api/notificaciones/1', { method: 'PATCH' });
    const res = await PATCH(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    expect(mockDb.notificaciones.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { leida: true } }),
    );
  });
});

describe('PATCH /api/notificaciones/marcar-todas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks all as read', async () => {
    mockPrismaGlobal.notificaciones.updateMany.mockResolvedValue({ count: 3 });
    const req = new Request('http://localhost/api/notificaciones/marcar-todas', {
      method: 'PATCH',
    });
    const res = await PATCHAll(req, {});
    expect(res.status).toBe(200);
  });
});
