import { tenantPrisma, prisma } from './prisma';

export interface AreaBudgetStatus {
  area: string;
  presupuestoAnual: number | null;
  presupuestoMensual: number | null;
  gastoAnual: number;
  gastoMensual: number;
  excedidoAnual: boolean;
  excedidoMensual: boolean;
}

/**
 * Hard-check area budget. Returns { permitido: false } if the new amount
 * would push the area over its monthly or annual budget.
 *
 * NOTE: This function and `verificarPresupuesto` (centro_costo) run similar
 * aggregation queries. They are intentionally separate because they are called
 * from different routes (compras POST vs solicitudes aprobar). If a caller ever
 * needs both checks, consider a combined query to avoid two round-trips.
 */
export async function verificarPresupuestoArea(
  tenantId: number,
  areaId: number,
  montoNuevo: number
): Promise<{ permitido: boolean; status: AreaBudgetStatus; mensaje?: string }> {
  const db = tenantPrisma(tenantId);

  const area = await db.areas.findFirst({ where: { id: areaId } });
  if (!area) return { permitido: true, status: {} as AreaBudgetStatus };

  const presupuestoAnual = area.presupuesto_anual != null ? Number(area.presupuesto_anual) : null;
  const presupuestoMensual = area.presupuesto_mensual != null ? Number(area.presupuesto_mensual) : null;

  // No budgets configured → allow
  if (presupuestoAnual === null && presupuestoMensual === null) {
    return { permitido: true, status: { area: area.nombre, presupuestoAnual, presupuestoMensual, gastoAnual: 0, gastoMensual: 0, excedidoAnual: false, excedidoMensual: false } };
  }

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const gastos = await prisma.$queryRaw<{ gasto_anual: number; gasto_mensual: number }[]>`
    SELECT
      COALESCE(SUM(c.monto_total), 0)::float AS gasto_anual,
      COALESCE(SUM(CASE WHEN c.fecha_compra >= ${startOfMonth} THEN c.monto_total ELSE 0 END), 0)::float AS gasto_mensual
    FROM compras c
    JOIN solicitudes s ON s.id = c.solicitud_id
    WHERE s.tenant_id = ${tenantId}
      AND s.area_id = ${areaId}
      AND s.estado IN ('abonada', 'recibida', 'recibida_con_obs', 'cerrada')
      AND c.fecha_compra >= ${startOfYear}
  `;

  const gastoAnual = Number(gastos[0]?.gasto_anual ?? 0);
  const gastoMensual = Number(gastos[0]?.gasto_mensual ?? 0);

  const excedidoAnual = presupuestoAnual !== null && (gastoAnual + montoNuevo) > presupuestoAnual;
  const excedidoMensual = presupuestoMensual !== null && (gastoMensual + montoNuevo) > presupuestoMensual;

  const status: AreaBudgetStatus = { area: area.nombre, presupuestoAnual, presupuestoMensual, gastoAnual, gastoMensual, excedidoAnual, excedidoMensual };

  if (excedidoMensual && excedidoAnual) {
    return { permitido: false, status, mensaje: `El área "${area.nombre}" excede el presupuesto mensual ($${gastoMensual.toLocaleString('es-AR')} + $${montoNuevo.toLocaleString('es-AR')} > $${presupuestoMensual!.toLocaleString('es-AR')}) y anual ($${gastoAnual.toLocaleString('es-AR')} + $${montoNuevo.toLocaleString('es-AR')} > $${presupuestoAnual!.toLocaleString('es-AR')})` };
  }
  if (excedidoMensual) {
    return { permitido: false, status, mensaje: `El área "${area.nombre}" excede el presupuesto mensual: gasto actual $${gastoMensual.toLocaleString('es-AR')} + $${montoNuevo.toLocaleString('es-AR')} supera el límite de $${presupuestoMensual!.toLocaleString('es-AR')}` };
  }
  if (excedidoAnual) {
    return { permitido: false, status, mensaje: `El área "${area.nombre}" excede el presupuesto anual: gasto actual $${gastoAnual.toLocaleString('es-AR')} + $${montoNuevo.toLocaleString('es-AR')} supera el límite de $${presupuestoAnual!.toLocaleString('es-AR')}` };
  }

  return { permitido: true, status };
}

export interface BudgetStatus {
  centroCosto: string;
  presupuestoAnual: number | null;
  presupuestoMensual: number | null;
  gastoAnual: number;
  gastoMensual: number;
  disponibleAnual: number | null;
  disponibleMensual: number | null;
  excedido: boolean;
  alertaPorcentaje: number; // 0-100, percentage of budget used
}

export async function verificarPresupuesto(
  tenantId: number,
  centroCostoId: number,
  montoNuevo: number
): Promise<{ permitido: boolean; status: BudgetStatus }> {
  const db = tenantPrisma(tenantId);

  const centroCosto = await db.centros_costo.findFirst({
    where: { id: centroCostoId },
  });

  if (!centroCosto) {
    return { permitido: true, status: {} as BudgetStatus };
  }

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Use SQL SUM for efficient aggregation instead of fetching all rows
  const gastos = await prisma.$queryRaw<{ gasto_anual: number; gasto_mensual: number }[]>`
    SELECT
      COALESCE(SUM(c.monto_total), 0)::float AS gasto_anual,
      COALESCE(SUM(CASE WHEN c.fecha_compra >= ${startOfMonth} THEN c.monto_total ELSE 0 END), 0)::float AS gasto_mensual
    FROM compras c
    JOIN solicitudes s ON s.id = c.solicitud_id
    WHERE s.tenant_id = ${tenantId}
      AND s.centro_costo_id = ${centroCostoId}
      AND s.estado IN ('abonada', 'recibida', 'recibida_con_obs', 'cerrada')
      AND c.fecha_compra >= ${startOfYear}
  `;

  const gastoAnual = Number(gastos[0]?.gasto_anual ?? 0);
  const gastoMensual = Number(gastos[0]?.gasto_mensual ?? 0);

  const presupuestoAnual = centroCosto.presupuesto_anual != null ? Number(centroCosto.presupuesto_anual) : null;
  const presupuestoMensual = centroCosto.presupuesto_mensual != null ? Number(centroCosto.presupuesto_mensual) : null;

  const disponibleAnual = presupuestoAnual !== null ? presupuestoAnual - gastoAnual : null;
  const disponibleMensual = presupuestoMensual !== null ? presupuestoMensual - gastoMensual : null;

  // Check if new amount would exceed budget
  const excederiaAnual = disponibleAnual !== null && (gastoAnual + montoNuevo) > presupuestoAnual!;
  const excederiaMensual = disponibleMensual !== null && (gastoMensual + montoNuevo) > presupuestoMensual!;

  const excedido = excederiaAnual || excederiaMensual;
  const alertaPorcentaje = presupuestoAnual
    ? Math.round(((gastoAnual + montoNuevo) / presupuestoAnual) * 100)
    : 0;

  const status: BudgetStatus = {
    centroCosto: centroCosto.nombre,
    presupuestoAnual,
    presupuestoMensual,
    gastoAnual,
    gastoMensual,
    disponibleAnual,
    disponibleMensual,
    excedido,
    alertaPorcentaje,
  };

  // Budget is a WARNING, not a hard block (configurable later)
  return { permitido: true, status };
}
