import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    suscripciones: { findUnique: vi.fn() },
    areas: { count: vi.fn() },
    centros_costo: { count: vi.fn() },
    usuarios: { count: vi.fn() },
    usuarios_roles: { count: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
// Bypass the cache so each test sees a fresh read.
vi.mock('@/lib/cache', () => ({
  cached: <T>(_key: string, _ttl: number, fetcher: () => Promise<T>) => fetcher(),
  invalidateCache: vi.fn(),
  invalidateTenantCache: vi.fn(),
}));

import {
  canCreateArea,
  canCreateCentroCosto,
  canAssignRole,
  getEffectivePlan,
  getPlanUsage,
} from '@/lib/plan-limits';

const defaultPlan = {
  id: 1,
  nombre: 'box-principal',
  precio_ars: 152000,
  trial_dias: 14,
  limite_areas: 3,
  limite_cc_por_area: 2,
  limite_responsable_area: 1,
  limite_director: 1,
  limite_tesoreria: 1,
  limite_admin: 1,
  limite_compras: 1,
  stripe_price_id: null,
  activo: true,
  created_at: new Date(),
  updated_at: new Date(),
};

function setPlan() {
  mocks.prisma.suscripciones.findUnique.mockResolvedValue({
    tenant_id: 1,
    plan_id: 1,
    plan: defaultPlan,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setPlan();
});

// ── getEffectivePlan ──

describe('getEffectivePlan', () => {
  it('returns the plan limits for a tenant with a subscription', async () => {
    const plan = await getEffectivePlan(1);
    expect(plan.limite_areas).toBe(3);
    expect(plan.limite_cc_por_area).toBe(2);
    expect(plan.limite_director).toBe(1);
  });

  it('throws when the tenant has no subscription', async () => {
    mocks.prisma.suscripciones.findUnique.mockResolvedValue(null);
    await expect(getEffectivePlan(99)).rejects.toThrow(/no subscription/i);
  });
});

// ── canCreateArea ──

describe('canCreateArea', () => {
  it('allows when under the limit', async () => {
    mocks.prisma.areas.count.mockResolvedValue(2);
    const result = await canCreateArea(1);
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(2);
    expect(result.limit).toBe(3);
  });

  it('blocks at the limit', async () => {
    mocks.prisma.areas.count.mockResolvedValue(3);
    const result = await canCreateArea(1);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('PLAN_LIMIT_AREAS');
    expect(result.message).toContain('3');
  });
});

// ── canCreateCentroCosto ──

describe('canCreateCentroCosto', () => {
  it('allows when the area has room', async () => {
    mocks.prisma.centros_costo.count.mockResolvedValue(1);
    const result = await canCreateCentroCosto(1, 10);
    expect(result.allowed).toBe(true);
    expect(mocks.prisma.centros_costo.count).toHaveBeenCalledWith({
      where: { tenant_id: 1, area_id: 10 },
    });
  });

  it('blocks when the area is full', async () => {
    mocks.prisma.centros_costo.count.mockResolvedValue(2);
    const result = await canCreateCentroCosto(1, 10);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('PLAN_LIMIT_CC_POR_AREA');
  });
});

// ── canAssignRole ──

describe('canAssignRole', () => {
  it('always allows solicitante', async () => {
    const result = await canAssignRole(1, 'solicitante');
    expect(result.allowed).toBe(true);
    expect(result.code).toBe('OK');
    // Should short-circuit before any DB call
    expect(mocks.prisma.suscripciones.findUnique).not.toHaveBeenCalled();
  });

  it('always allows super_admin (platform role)', async () => {
    const result = await canAssignRole(1, 'super_admin');
    expect(result.allowed).toBe(true);
  });

  it('allows the first director (count 0, limit 1)', async () => {
    mocks.prisma.usuarios_roles.count.mockResolvedValue(0);
    const result = await canAssignRole(1, 'director');
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(0);
    expect(result.limit).toBe(1);
  });

  it('blocks the second director', async () => {
    mocks.prisma.usuarios_roles.count.mockResolvedValue(1);
    const result = await canAssignRole(1, 'director');
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('PLAN_LIMIT_DIRECTOR');
  });

  it('fails closed on an unknown role', async () => {
    const result = await canAssignRole(1, 'rol_inventado');
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('UNKNOWN_ROLE');
  });

  it('requires areaId for responsable_area', async () => {
    const result = await canAssignRole(1, 'responsable_area');
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('AREA_ID_REQUIRED');
  });

  it('allows a responsable in an area that has none', async () => {
    mocks.prisma.usuarios_roles.count.mockResolvedValue(0);
    const result = await canAssignRole(1, 'responsable_area', 10);
    expect(result.allowed).toBe(true);
    expect(mocks.prisma.usuarios_roles.count).toHaveBeenCalledWith({
      where: {
        rol: { nombre: 'responsable_area' },
        usuario: { tenant_id: 1, area_id: 10, activo: true },
      },
    });
  });

  it('blocks a second responsable in the same area', async () => {
    mocks.prisma.usuarios_roles.count.mockResolvedValue(1);
    const result = await canAssignRole(1, 'responsable_area', 10);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('PLAN_LIMIT_RESPONSABLE_AREA');
  });
});

// ── getPlanUsage ──

describe('getPlanUsage', () => {
  it('aggregates counts for every tracked resource', async () => {
    mocks.prisma.areas.count.mockResolvedValue(2);
    mocks.prisma.centros_costo.count.mockResolvedValue(4);
    mocks.prisma.usuarios_roles.count
      .mockResolvedValueOnce(1) // director
      .mockResolvedValueOnce(0) // tesoreria
      .mockResolvedValueOnce(1) // admin
      .mockResolvedValueOnce(0) // compras
      .mockResolvedValueOnce(2); // responsable_area total
    mocks.prisma.usuarios.count.mockResolvedValue(2); // areas_con_responsable

    const usage = await getPlanUsage(1);

    expect(usage.areas).toEqual({ count: 2, limit: 3 });
    expect(usage.centros_costo).toEqual({ count: 4, limit_per_area: 2, total_limit: 6 });
    expect(usage.roles.director).toEqual({ count: 1, limit: 1 });
    expect(usage.roles.tesoreria).toEqual({ count: 0, limit: 1 });
    expect(usage.roles.responsable_area.total).toBe(2);
    expect(usage.roles.responsable_area.areas_con_responsable).toBe(2);
    expect(usage.roles.responsable_area.limit_per_area).toBe(1);
  });
});
