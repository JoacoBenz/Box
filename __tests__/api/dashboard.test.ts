import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──
const { mockSession, mockDb, mockPrisma, mockGetResumenPresupuesto } = vi.hoisted(() => {
  const mockSession = {
    userId: 1,
    tenantId: 10,
    roles: [] as string[],
    nombre: 'Test User',
    email: 'test@test.com',
    areaId: 5,
  };

  // Tenant-scoped DB returned by tenantPrisma (or as db when effectiveTenantId set)
  const mockDb = {
    solicitudes: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    areas: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    usuarios: { count: vi.fn().mockResolvedValue(0) },
    centros_costo: { count: vi.fn().mockResolvedValue(0) },
    codigos_invitacion: { count: vi.fn().mockResolvedValue(0) },
    compras: { findMany: vi.fn().mockResolvedValue([]) },
  };

  // Global prisma (used for raw SQL and super_admin queries)
  const mockPrisma = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    tenants: { count: vi.fn().mockResolvedValue(0) },
    usuarios: { count: vi.fn().mockResolvedValue(0) },
  };

  const mockGetResumenPresupuesto = vi.fn().mockResolvedValue({
    areas: [],
    totalPresupuesto: 0,
    totalGasto: 0,
  });

  return { mockSession, mockDb, mockPrisma, mockGetResumenPresupuesto };
});

// ── Module mocks ──
vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn().mockResolvedValue(mockSession),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  tenantPrisma: vi.fn(() => mockDb),
}));
vi.mock('@/lib/permissions', () => ({
  verificarRol: vi.fn().mockReturnValue(true),
  apiError: vi.fn(
    (code: string, msg: string, status: number, details?: any) =>
      new Response(JSON.stringify({ error: { code, message: msg, details } }), { status }),
  ),
}));
vi.mock('@/lib/audit', () => ({
  getClientIp: vi.fn(() => '1.2.3.4'),
}));
vi.mock('@/lib/tenant-override', () => ({
  getEffectiveTenantId: vi
    .fn()
    .mockResolvedValue({ session: mockSession, effectiveTenantId: mockSession.tenantId }),
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitDb: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock('@/lib/logger', () => ({ logApiError: vi.fn() }));
vi.mock('@/lib/cache', () => ({
  cached: vi.fn(async (_key: string, _ttl: number, fetcher: () => Promise<any>) => fetcher()),
}));
vi.mock('@/lib/budget-control', () => ({
  getResumenPresupuesto: mockGetResumenPresupuesto,
}));
vi.mock('@/types', () => ({}));
vi.mock('@/app/generated/prisma/client', () => ({
  Prisma: { sql: (...args: any[]) => args, empty: '' },
}));

import { GET } from '@/app/api/dashboard/route';
import { getEffectiveTenantId } from '@/lib/tenant-override';
import { tenantPrisma } from '@/lib/prisma';

const mockGetEffective = getEffectiveTenantId as any;
const mockTenantPrisma = tenantPrisma as any;

function makeRequest(url = 'http://localhost/api/dashboard') {
  return new Request(url, { method: 'GET' });
}

describe('GET /api/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset session to defaults
    mockSession.userId = 1;
    mockSession.tenantId = 10;
    mockSession.roles = [];
    mockSession.areaId = 5;

    // Re-setup default mock returns
    mockDb.solicitudes.findMany.mockResolvedValue([]);
    mockDb.solicitudes.count.mockResolvedValue(0);
    mockDb.areas.findMany.mockResolvedValue([]);
    mockDb.areas.count.mockResolvedValue(0);
    mockDb.usuarios.count.mockResolvedValue(0);
    mockDb.centros_costo.count.mockResolvedValue(0);
    mockDb.codigos_invitacion.count.mockResolvedValue(0);
    mockDb.compras.findMany.mockResolvedValue([]);
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.tenants.count.mockResolvedValue(0);
    mockPrisma.usuarios.count.mockResolvedValue(0);
    mockGetResumenPresupuesto.mockResolvedValue({
      areas: [],
      totalPresupuesto: 0,
      totalGasto: 0,
    });

    mockGetEffective.mockResolvedValue({
      session: mockSession,
      effectiveTenantId: mockSession.tenantId,
    });
    mockTenantPrisma.mockReturnValue(mockDb);
  });

  // ── Solicitante ──

  it('returns solicitante data only for solicitante role', async () => {
    mockSession.roles = ['solicitante'];
    mockGetEffective.mockResolvedValue({
      session: mockSession,
      effectiveTenantId: mockSession.tenantId,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    // Solicitante keys should be present
    expect(json).toHaveProperty('misSolicitudes');
    expect(json).toHaveProperty('solicitudesEnEjecucion');
    expect(json).toHaveProperty('solicitudesDevueltas');
    expect(json).toHaveProperty('recepcionesPendientes');
    expect(json).toHaveProperty('solicitudesMesSolicitante');
    expect(json).toHaveProperty('tasaAprobacion');
    expect(json).toHaveProperty('misSolicitudesPorEstado');

    // Director keys should NOT be present
    expect(json).not.toHaveProperty('pendientesAprobar');
    expect(json).not.toHaveProperty('pipeline');
    // Admin keys should NOT be present
    expect(json).not.toHaveProperty('orgAdmin');
    // Super admin keys should NOT be present
    expect(json).not.toHaveProperty('adminPlatform');
    // Analytics should NOT be present (solicitante not in analytics roles)
    expect(json).not.toHaveProperty('gastoAnual');
  });

  // ── Director ──

  it('returns director data only for director role', async () => {
    mockSession.roles = ['director'];
    mockGetEffective.mockResolvedValue({
      session: mockSession,
      effectiveTenantId: mockSession.tenantId,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    // Director keys
    expect(json).toHaveProperty('areasDisponibles');
    expect(json).toHaveProperty('pendientesAprobar');
    expect(json).toHaveProperty('aprobadasSemana');
    expect(json).toHaveProperty('rechazadasSemana');
    expect(json).toHaveProperty('urgentesPendientesDir');
    expect(json).toHaveProperty('pipeline');
    expect(json).toHaveProperty('topPendientes');
    expect(json).toHaveProperty('tiempoCiclo');
    expect(json).toHaveProperty('resumenPresupuesto');

    // Analytics loaded for director
    expect(json).toHaveProperty('gastoAnual');
    expect(json).toHaveProperty('gastoMensual');
    expect(json).toHaveProperty('gastoPorArea');

    // Solicitante keys NOT present
    expect(json).not.toHaveProperty('misSolicitudes');
    // Admin keys NOT present
    expect(json).not.toHaveProperty('orgAdmin');
    // Super admin NOT present
    expect(json).not.toHaveProperty('adminPlatform');
  });

  // ── Admin ──

  it('returns admin orgAdmin data for admin role', async () => {
    mockSession.roles = ['admin'];
    mockGetEffective.mockResolvedValue({
      session: mockSession,
      effectiveTenantId: mockSession.tenantId,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    // Admin org keys
    expect(json).toHaveProperty('orgAdmin');
    expect(json.orgAdmin).toHaveProperty('totalUsuarios');
    expect(json.orgAdmin).toHaveProperty('usuariosActivos');
    expect(json.orgAdmin).toHaveProperty('totalAreas');
    expect(json.orgAdmin).toHaveProperty('areasConResponsable');
    expect(json.orgAdmin).toHaveProperty('totalCentrosCosto');
    expect(json.orgAdmin).toHaveProperty('invitacionesActivas');
    expect(json.orgAdmin).toHaveProperty('ultimasAuditorias');
    expect(json.orgAdmin).toHaveProperty('solicitudesActivas');

    // Admin gets resumenPresupuesto
    expect(json).toHaveProperty('resumenPresupuesto');

    // Analytics loaded for admin
    expect(json).toHaveProperty('gastoAnual');

    // Super admin NOT present
    expect(json).not.toHaveProperty('adminPlatform');
    // Solicitante NOT present
    expect(json).not.toHaveProperty('misSolicitudes');
  });

  // ── Admin tenant scoping ──

  it('admin queries are scoped to session tenant when effectiveTenantId is null', async () => {
    mockSession.roles = ['admin'];
    // effectiveTenantId is null — route should use session.tenantId
    mockGetEffective.mockResolvedValue({
      session: mockSession,
      effectiveTenantId: null,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    // Admin section should still populate (tdb = tenantPrisma(session.tenantId))
    expect(json).toHaveProperty('orgAdmin');

    // tenantPrisma should have been called with the session's tenantId
    expect(mockTenantPrisma).toHaveBeenCalledWith(mockSession.tenantId);

    // tdb model calls use mockDb (scoped)
    expect(mockDb.usuarios.count).toHaveBeenCalled();
    expect(mockDb.areas.count).toHaveBeenCalled();
  });

  // ── Super admin ──

  it('super_admin gets platform metrics', async () => {
    mockSession.roles = ['super_admin'];
    mockGetEffective.mockResolvedValue({
      session: mockSession,
      effectiveTenantId: mockSession.tenantId,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    // Platform-level keys
    expect(json).toHaveProperty('adminPlatform');
    expect(json.adminPlatform).toHaveProperty('totalOrganizaciones');
    expect(json.adminPlatform).toHaveProperty('orgActivas');
    expect(json.adminPlatform).toHaveProperty('orgPendientes');
    expect(json.adminPlatform).toHaveProperty('orgSuspendidas');
    expect(json.adminPlatform).toHaveProperty('totalUsuariosPlataforma');
    expect(json.adminPlatform).toHaveProperty('usuariosNuevosMes');
    expect(json.adminPlatform).toHaveProperty('orgsNuevasMes');
    expect(json.adminPlatform).toHaveProperty('orgsDormidas');
    expect(json.adminPlatform).toHaveProperty('promedioUsuariosPorOrg');
    expect(json.adminPlatform).toHaveProperty('crecimientoOrgs');
    expect(json.adminPlatform).toHaveProperty('crecimientoUsuarios');
    expect(json.adminPlatform).toHaveProperty('orgsTopUso');

    // super_admin uses global prisma (not tenant-scoped) for platform counts
    expect(mockPrisma.tenants.count).toHaveBeenCalled();
    expect(mockPrisma.usuarios.count).toHaveBeenCalled();
  });

  // ── Analytics ──

  it('analytics data loaded for director/admin/tesoreria/compras', async () => {
    const analyticsRoles = ['director', 'admin', 'tesoreria', 'compras'];

    for (const role of analyticsRoles) {
      vi.clearAllMocks();
      mockDb.solicitudes.findMany.mockResolvedValue([]);
      mockDb.solicitudes.count.mockResolvedValue(0);
      mockDb.areas.findMany.mockResolvedValue([]);
      mockDb.areas.count.mockResolvedValue(0);
      mockDb.usuarios.count.mockResolvedValue(0);
      mockDb.centros_costo.count.mockResolvedValue(0);
      mockDb.codigos_invitacion.count.mockResolvedValue(0);
      mockDb.compras.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.tenants.count.mockResolvedValue(0);
      mockPrisma.usuarios.count.mockResolvedValue(0);
      mockGetResumenPresupuesto.mockResolvedValue({
        areas: [],
        totalPresupuesto: 0,
        totalGasto: 0,
      });
      mockTenantPrisma.mockReturnValue(mockDb);

      mockSession.roles = [role];
      mockGetEffective.mockResolvedValue({
        session: mockSession,
        effectiveTenantId: mockSession.tenantId,
      });

      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json).toHaveProperty('gastoAnual');
      expect(json).toHaveProperty('gastoMensual');
      expect(json).toHaveProperty('gastoPorArea');
      expect(json).toHaveProperty('tendenciaMensual');
      expect(json).toHaveProperty('gastoPorMedioPago');
      expect(json).toHaveProperty('topProveedores');
      expect(json).toHaveProperty('solicitudesPorEstado');
      expect(json).toHaveProperty('solicitudesPorUrgencia');
    }
  });

  // ── No matching sections ──

  it('returns empty result for role with no matching sections', async () => {
    // A role that has no dedicated section in the dashboard
    mockSession.roles = ['auditor'];
    mockGetEffective.mockResolvedValue({
      session: mockSession,
      effectiveTenantId: mockSession.tenantId,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    // No sections should be populated
    expect(json).not.toHaveProperty('misSolicitudes');
    expect(json).not.toHaveProperty('pendientesValidar');
    expect(json).not.toHaveProperty('pendientesAprobar');
    expect(json).not.toHaveProperty('orgAdmin');
    expect(json).not.toHaveProperty('adminPlatform');
    expect(json).not.toHaveProperty('solicitudesAprobadas');
    expect(json).not.toHaveProperty('pendientesComprar');
    expect(json).not.toHaveProperty('gastoAnual');
    expect(Object.keys(json).length).toBe(0);
  });

  // ── Tenant fallback ──

  it('tenantId falls back to session.tenantId when effectiveTenantId is null', async () => {
    mockSession.roles = ['solicitante'];
    mockSession.tenantId = 42;
    mockGetEffective.mockResolvedValue({
      session: mockSession,
      effectiveTenantId: null,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    // When effectiveTenantId is null, route does:
    //   const tenantId = effectiveTenantId ?? session.tenantId  => 42
    //   const tdb = effectiveTenantId ? db : tenantPrisma(tenantId)
    // So tenantPrisma should be called with session.tenantId
    expect(mockTenantPrisma).toHaveBeenCalledWith(42);
  });

  // ── Responsable area ──

  it('returns responsable_area data when role and areaId are present', async () => {
    mockSession.roles = ['responsable_area'];
    mockSession.areaId = 5;
    mockGetEffective.mockResolvedValue({
      session: mockSession,
      effectiveTenantId: mockSession.tenantId,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json).toHaveProperty('pendientesValidar');
    expect(json).toHaveProperty('solicitudesArea');
    expect(json).toHaveProperty('solicitudesAreaMes');
    expect(json).toHaveProperty('devueltasArea');
    expect(json).toHaveProperty('gastoAreaMes');
    expect(json).toHaveProperty('gastoAreaAño');
    expect(json).toHaveProperty('solicitudesAreaPorEstado');
  });

  // ── Compras ──

  it('returns compras section data for compras role', async () => {
    mockSession.roles = ['compras'];
    mockGetEffective.mockResolvedValue({
      session: mockSession,
      effectiveTenantId: mockSession.tenantId,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json).toHaveProperty('solicitudesAprobadas');
    expect(json).toHaveProperty('solicitudesEnCompras');
    expect(json).toHaveProperty('pagoProgramado');
    expect(json).toHaveProperty('urgentesPipeline');
    expect(json).toHaveProperty('pipeline');
    expect(json).toHaveProperty('tiempoPromedioPipeline');
  });

  // ── Tesoreria ──

  it('returns tesoreria section data for tesoreria role', async () => {
    mockSession.roles = ['tesoreria'];
    mockGetEffective.mockResolvedValue({
      session: mockSession,
      effectiveTenantId: mockSession.tenantId,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json).toHaveProperty('pendientesComprar');
    expect(json).toHaveProperty('ultimasCompras');
    expect(json).toHaveProperty('comprasSinRecepcion');
    expect(json).toHaveProperty('resumenPresupuesto');
    // Analytics also loaded for tesoreria
    expect(json).toHaveProperty('gastoAnual');
  });

  // ── Tesoreria budget: not duplicated when also director ──

  it('tesoreria does not load resumenPresupuesto separately when also director', async () => {
    mockSession.roles = ['director', 'tesoreria'];
    mockGetEffective.mockResolvedValue({
      session: mockSession,
      effectiveTenantId: mockSession.tenantId,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    // resumenPresupuesto loaded via director block
    expect(json).toHaveProperty('resumenPresupuesto');
    // The budget helper should be called (by director), but tesoreria skips it
    // because the condition is `roles.includes('tesoreria') && !roles.includes('director')`
    expect(mockGetResumenPresupuesto).toHaveBeenCalledTimes(1);
  });
});
