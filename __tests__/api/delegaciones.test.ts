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
    delegaciones: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
  return { mockSession, mockDb };
});

vi.mock('@/lib/auth', () => ({ getServerSession: vi.fn().mockResolvedValue(mockSession) }));
vi.mock('@/lib/prisma', () => ({ prisma: mockDb, tenantPrisma: vi.fn(() => mockDb) }));
vi.mock('@/lib/permissions', () => ({
  verificarRol: vi
    .fn()
    .mockImplementation((_roles: string[], required: string[]) =>
      required.some((r: string) => mockSession.roles.includes(r) || r === 'admin'),
    ),
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
vi.mock('@/lib/cache', () => ({ invalidateCache: vi.fn() }));

import { GET, POST } from '@/app/api/delegaciones/route';
import { PATCH } from '@/app/api/delegaciones/[id]/route';

describe('GET /api/delegaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns delegaciones', async () => {
    const deleg = [{ id: 1, delegante_id: 1, delegado_id: 2, activo: true }];
    mockDb.delegaciones.findMany.mockResolvedValue(deleg);
    const req = new Request('http://localhost/api/delegaciones');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(deleg);
  });
});

describe('POST /api/delegaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a delegation', async () => {
    mockDb.delegaciones.create.mockResolvedValue({ id: 1 });
    const futureStart = new Date();
    futureStart.setDate(futureStart.getDate() + 1);
    const futureEnd = new Date();
    futureEnd.setDate(futureEnd.getDate() + 7);
    const req = new Request('http://localhost/api/delegaciones', {
      method: 'POST',
      body: JSON.stringify({
        delegado_id: 2,
        rol_delegado: 'director',
        fecha_inicio: futureStart.toISOString(),
        fecha_fin: futureEnd.toISOString(),
        motivo: 'Vacaciones',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/delegaciones/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deactivates a delegation', async () => {
    mockDb.delegaciones.findFirst.mockResolvedValue({ id: 1, delegante_id: 1, delegado_id: 2 });
    mockDb.delegaciones.update.mockResolvedValue({});
    const req = new Request('http://localhost/api/delegaciones/1', { method: 'PATCH' });
    const res = await PATCH(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    expect(mockDb.delegaciones.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { activo: false } }),
    );
  });
});
