import { prisma } from './prisma';
import { cached } from './cache';

export type LimitCheck = {
  allowed: boolean;
  count: number;
  limit: number;
  code: string;
  message: string;
};

export type PlanSnapshot = {
  id: number;
  nombre: string;
  limite_areas: number;
  limite_cc_por_area: number;
  limite_responsable_area: number;
  limite_director: number;
  limite_tesoreria: number;
  limite_admin: number;
  limite_compras: number;
};

/** Role names with a tenant-wide cap in the plan. */
export const TENANT_SCOPED_ROLES = ['director', 'tesoreria', 'admin', 'compras'] as const;
/** Role names with a per-area cap in the plan. */
export const AREA_SCOPED_ROLES = ['responsable_area'] as const;
/** Roles without a cap. */
export const UNLIMITED_ROLES = ['solicitante', 'super_admin'] as const;

const CACHE_TTL_MS = 60_000;

function planFieldForRole(
  rolNombre: string,
):
  | 'limite_director'
  | 'limite_tesoreria'
  | 'limite_admin'
  | 'limite_compras'
  | 'limite_responsable_area'
  | null {
  switch (rolNombre) {
    case 'director':
      return 'limite_director';
    case 'tesoreria':
      return 'limite_tesoreria';
    case 'admin':
      return 'limite_admin';
    case 'compras':
      return 'limite_compras';
    case 'responsable_area':
      return 'limite_responsable_area';
    default:
      return null;
  }
}

/** Fetch the plan for a tenant (cached). Throws if tenant has no subscription. */
export async function getEffectivePlan(tenantId: number): Promise<PlanSnapshot> {
  return cached(`t:${tenantId}:plan`, CACHE_TTL_MS, async () => {
    const sub = await prisma.suscripciones.findUnique({
      where: { tenant_id: tenantId },
      include: { plan: true },
    });
    if (!sub) {
      throw new Error(`Tenant ${tenantId} has no subscription`);
    }
    const p = sub.plan;
    return {
      id: p.id,
      nombre: p.nombre,
      limite_areas: p.limite_areas,
      limite_cc_por_area: p.limite_cc_por_area,
      limite_responsable_area: p.limite_responsable_area,
      limite_director: p.limite_director,
      limite_tesoreria: p.limite_tesoreria,
      limite_admin: p.limite_admin,
      limite_compras: p.limite_compras,
    };
  });
}

export async function canCreateArea(tenantId: number): Promise<LimitCheck> {
  const plan = await getEffectivePlan(tenantId);
  const count = await prisma.areas.count({ where: { tenant_id: tenantId } });
  return {
    allowed: count < plan.limite_areas,
    count,
    limit: plan.limite_areas,
    code: 'PLAN_LIMIT_AREAS',
    message: `Tu plan permite hasta ${plan.limite_areas} áreas. Ya tenés ${count}.`,
  };
}

export async function canCreateCentroCosto(tenantId: number, areaId: number): Promise<LimitCheck> {
  const plan = await getEffectivePlan(tenantId);
  const count = await prisma.centros_costo.count({
    where: { tenant_id: tenantId, area_id: areaId },
  });
  return {
    allowed: count < plan.limite_cc_por_area,
    count,
    limit: plan.limite_cc_por_area,
    code: 'PLAN_LIMIT_CC_POR_AREA',
    message: `Tu plan permite hasta ${plan.limite_cc_por_area} centros de costo por área. El área ya tiene ${count}.`,
  };
}

/**
 * Check whether assigning `rolNombre` to a user in `tenantId` would exceed
 * the plan limit. For `responsable_area`, `areaId` is required.
 */
export async function canAssignRole(
  tenantId: number,
  rolNombre: string,
  areaId?: number | null,
): Promise<LimitCheck> {
  if ((UNLIMITED_ROLES as readonly string[]).includes(rolNombre)) {
    return {
      allowed: true,
      count: 0,
      limit: Number.POSITIVE_INFINITY,
      code: 'OK',
      message: 'Sin límite',
    };
  }

  const field = planFieldForRole(rolNombre);
  if (!field) {
    // Unknown role: fail closed so typos can't silently bypass enforcement.
    return {
      allowed: false,
      count: 0,
      limit: 0,
      code: 'UNKNOWN_ROLE',
      message: `Rol desconocido: ${rolNombre}`,
    };
  }

  const plan = await getEffectivePlan(tenantId);
  const limit = plan[field];

  let count: number;
  if (rolNombre === 'responsable_area') {
    if (typeof areaId !== 'number') {
      return {
        allowed: false,
        count: 0,
        limit,
        code: 'AREA_ID_REQUIRED',
        message: 'Falta areaId para evaluar responsable_area',
      };
    }
    count = await prisma.usuarios_roles.count({
      where: {
        rol: { nombre: 'responsable_area' },
        usuario: { tenant_id: tenantId, area_id: areaId, activo: true },
      },
    });
  } else {
    count = await prisma.usuarios_roles.count({
      where: {
        rol: { nombre: rolNombre },
        usuario: { tenant_id: tenantId, activo: true },
      },
    });
  }

  return {
    allowed: count < limit,
    count,
    limit,
    code: `PLAN_LIMIT_${rolNombre.toUpperCase()}`,
    message:
      rolNombre === 'responsable_area'
        ? `El área ya tiene ${count} responsable_area (máximo ${limit}).`
        : `Tu plan permite ${limit} ${rolNombre} por organización. Ya hay ${count}.`,
  };
}

export type PlanUsage = {
  areas: { count: number; limit: number };
  centros_costo: { count: number; limit_per_area: number; total_limit: number };
  roles: Record<
    'director' | 'tesoreria' | 'admin' | 'compras',
    { count: number; limit: number }
  > & {
    responsable_area: { total: number; limit_per_area: number; areas_con_responsable: number };
  };
};

/** Complete snapshot of usage vs limits, for the /facturacion UI. */
export async function getPlanUsage(tenantId: number): Promise<PlanUsage> {
  const plan = await getEffectivePlan(tenantId);

  const [
    areasCount,
    ccCount,
    directorCount,
    tesoreriaCount,
    adminCount,
    comprasCount,
    respAreaCount,
    areasConResp,
  ] = await Promise.all([
    prisma.areas.count({ where: { tenant_id: tenantId } }),
    prisma.centros_costo.count({ where: { tenant_id: tenantId } }),
    prisma.usuarios_roles.count({
      where: { rol: { nombre: 'director' }, usuario: { tenant_id: tenantId, activo: true } },
    }),
    prisma.usuarios_roles.count({
      where: { rol: { nombre: 'tesoreria' }, usuario: { tenant_id: tenantId, activo: true } },
    }),
    prisma.usuarios_roles.count({
      where: { rol: { nombre: 'admin' }, usuario: { tenant_id: tenantId, activo: true } },
    }),
    prisma.usuarios_roles.count({
      where: { rol: { nombre: 'compras' }, usuario: { tenant_id: tenantId, activo: true } },
    }),
    prisma.usuarios_roles.count({
      where: {
        rol: { nombre: 'responsable_area' },
        usuario: { tenant_id: tenantId, activo: true },
      },
    }),
    prisma.usuarios.count({
      where: {
        tenant_id: tenantId,
        activo: true,
        usuarios_roles: { some: { rol: { nombre: 'responsable_area' } } },
      },
    }),
  ]);

  return {
    areas: { count: areasCount, limit: plan.limite_areas },
    centros_costo: {
      count: ccCount,
      limit_per_area: plan.limite_cc_por_area,
      total_limit: plan.limite_areas * plan.limite_cc_por_area,
    },
    roles: {
      director: { count: directorCount, limit: plan.limite_director },
      tesoreria: { count: tesoreriaCount, limit: plan.limite_tesoreria },
      admin: { count: adminCount, limit: plan.limite_admin },
      compras: { count: comprasCount, limit: plan.limite_compras },
      responsable_area: {
        total: respAreaCount,
        limit_per_area: plan.limite_responsable_area,
        areas_con_responsable: areasConResp,
      },
    },
  };
}
