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
 */
export async function verificarPresupuestoArea(
  tenantId: number,
  areaId: number,
  montoNuevo: number,
): Promise<{ permitido: boolean; status: AreaBudgetStatus; mensaje?: string }> {
  const db = tenantPrisma(tenantId);

  const area = await db.areas.findFirst({ where: { id: areaId } });
  if (!area) return { permitido: true, status: {} as AreaBudgetStatus };

  const presupuestoAnual = area.presupuesto_anual != null ? Number(area.presupuesto_anual) : null;
  const presupuestoMensual =
    area.presupuesto_mensual != null ? Number(area.presupuesto_mensual) : null;

  // No budgets configured → allow
  if (presupuestoAnual === null && presupuestoMensual === null) {
    return {
      permitido: true,
      status: {
        area: area.nombre,
        presupuestoAnual,
        presupuestoMensual,
        gastoAnual: 0,
        gastoMensual: 0,
        excedidoAnual: false,
        excedidoMensual: false,
      },
    };
  }

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const gastos = await prisma.$queryRaw<{ gasto_anual: number; gasto_mensual: number }[]>`
    SELECT
      COALESCE(SUM(c.monto_total), 0)::numeric AS gasto_anual,
      COALESCE(SUM(CASE WHEN c.fecha_compra >= ${startOfMonth} THEN c.monto_total ELSE 0 END), 0)::numeric AS gasto_mensual
    FROM compras c
    JOIN solicitudes s ON s.id = c.solicitud_id
    WHERE s.tenant_id = ${tenantId}
      AND s.area_id = ${areaId}
      AND s.estado IN ('abonada', 'recibida_con_obs', 'cerrada')
      AND c.fecha_compra >= ${startOfYear}
  `;

  const gastoAnual = Number(gastos[0]?.gasto_anual ?? 0);
  const gastoMensual = Number(gastos[0]?.gasto_mensual ?? 0);

  const excedidoAnual = presupuestoAnual !== null && gastoAnual + montoNuevo > presupuestoAnual;
  const excedidoMensual =
    presupuestoMensual !== null && gastoMensual + montoNuevo > presupuestoMensual;

  const status: AreaBudgetStatus = {
    area: area.nombre,
    presupuestoAnual,
    presupuestoMensual,
    gastoAnual,
    gastoMensual,
    excedidoAnual,
    excedidoMensual,
  };

  if (excedidoMensual && excedidoAnual) {
    return {
      permitido: false,
      status,
      mensaje: `El área "${area.nombre}" excede el presupuesto mensual ($${gastoMensual.toLocaleString('es-AR')} + $${montoNuevo.toLocaleString('es-AR')} > $${presupuestoMensual!.toLocaleString('es-AR')}) y anual ($${gastoAnual.toLocaleString('es-AR')} + $${montoNuevo.toLocaleString('es-AR')} > $${presupuestoAnual!.toLocaleString('es-AR')})`,
    };
  }
  if (excedidoMensual) {
    return {
      permitido: false,
      status,
      mensaje: `El área "${area.nombre}" excede el presupuesto mensual: gasto actual $${gastoMensual.toLocaleString('es-AR')} + $${montoNuevo.toLocaleString('es-AR')} supera el límite de $${presupuestoMensual!.toLocaleString('es-AR')}`,
    };
  }
  if (excedidoAnual) {
    return {
      permitido: false,
      status,
      mensaje: `El área "${area.nombre}" excede el presupuesto anual: gasto actual $${gastoAnual.toLocaleString('es-AR')} + $${montoNuevo.toLocaleString('es-AR')} supera el límite de $${presupuestoAnual!.toLocaleString('es-AR')}`,
    };
  }

  return { permitido: true, status };
}

/**
 * Check area budget including *committed* pending solicitudes (states:
 * enviada, validada, aprobada, en_compras, pago_programado) valued at their
 * item-level estimates. Used at solicitud creation/send time so a solicitante
 * can't stack drafts that together exceed the area budget.
 *
 * Monthly check attributes pending to the month of dia_pago_programado when
 * set, otherwise the creation month.
 */
export async function verificarPresupuestoSolicitanteArea(
  tenantId: number,
  areaId: number,
  montoNuevo: number,
): Promise<{ permitido: boolean; status: AreaBudgetStatus; mensaje?: string }> {
  const db = tenantPrisma(tenantId);

  const area = await db.areas.findFirst({ where: { id: areaId } });
  if (!area) return { permitido: true, status: {} as AreaBudgetStatus };

  const presupuestoAnual = area.presupuesto_anual != null ? Number(area.presupuesto_anual) : null;
  const presupuestoMensual =
    area.presupuesto_mensual != null ? Number(area.presupuesto_mensual) : null;

  if (presupuestoAnual === null && presupuestoMensual === null) {
    return {
      permitido: true,
      status: {
        area: area.nombre,
        presupuestoAnual,
        presupuestoMensual,
        gastoAnual: 0,
        gastoMensual: 0,
        excedidoAnual: false,
        excedidoMensual: false,
      },
    };
  }

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const rows = await prisma.$queryRaw<
    {
      real_anual: number;
      real_mensual: number;
      comprometido_anual: number;
      comprometido_mensual: number;
    }[]
  >`
    SELECT
      COALESCE((
        SELECT SUM(c.monto_total) FROM compras c
        JOIN solicitudes s ON s.id = c.solicitud_id AND s.tenant_id = c.tenant_id
        WHERE s.tenant_id = ${tenantId} AND s.area_id = ${areaId}
          AND s.estado IN ('abonada', 'recibida_con_obs', 'cerrada')
          AND c.fecha_compra >= ${startOfYear}
      ), 0)::float AS real_anual,
      COALESCE((
        SELECT SUM(c.monto_total) FROM compras c
        JOIN solicitudes s ON s.id = c.solicitud_id AND s.tenant_id = c.tenant_id
        WHERE s.tenant_id = ${tenantId} AND s.area_id = ${areaId}
          AND s.estado IN ('abonada', 'recibida_con_obs', 'cerrada')
          AND c.fecha_compra >= ${startOfMonth}
      ), 0)::float AS real_mensual,
      COALESCE((
        SELECT SUM(isol.precio_estimado * isol.cantidad)
        FROM solicitudes s
        JOIN items_solicitud isol ON isol.solicitud_id = s.id AND isol.tenant_id = s.tenant_id
        WHERE s.tenant_id = ${tenantId} AND s.area_id = ${areaId}
          AND s.estado IN ('enviada', 'validada', 'aprobada', 'en_compras', 'pago_programado')
      ), 0)::float AS comprometido_anual,
      COALESCE((
        SELECT SUM(isol.precio_estimado * isol.cantidad)
        FROM solicitudes s
        JOIN items_solicitud isol ON isol.solicitud_id = s.id AND isol.tenant_id = s.tenant_id
        WHERE s.tenant_id = ${tenantId} AND s.area_id = ${areaId}
          AND s.estado IN ('enviada', 'validada', 'aprobada', 'en_compras', 'pago_programado')
          AND (
            (s.dia_pago_programado IS NOT NULL AND s.dia_pago_programado >= ${startOfMonth})
            OR (s.dia_pago_programado IS NULL AND s.created_at >= ${startOfMonth})
          )
      ), 0)::float AS comprometido_mensual
  `;

  const gastoAnual = Number(rows[0]?.real_anual ?? 0) + Number(rows[0]?.comprometido_anual ?? 0);
  const gastoMensual =
    Number(rows[0]?.real_mensual ?? 0) + Number(rows[0]?.comprometido_mensual ?? 0);

  const excedidoAnual = presupuestoAnual !== null && gastoAnual + montoNuevo > presupuestoAnual;
  const excedidoMensual =
    presupuestoMensual !== null && gastoMensual + montoNuevo > presupuestoMensual;

  const status: AreaBudgetStatus = {
    area: area.nombre,
    presupuestoAnual,
    presupuestoMensual,
    gastoAnual,
    gastoMensual,
    excedidoAnual,
    excedidoMensual,
  };

  if (!excedidoAnual && !excedidoMensual) return { permitido: true, status };

  const fmt = (n: number) => `$${n.toLocaleString('es-AR')}`;
  const parts: string[] = [];
  if (excedidoMensual) {
    parts.push(
      `mensual (${fmt(gastoMensual)} comprometido + ${fmt(montoNuevo)} > ${fmt(presupuestoMensual!)})`,
    );
  }
  if (excedidoAnual) {
    parts.push(
      `anual (${fmt(gastoAnual)} comprometido + ${fmt(montoNuevo)} > ${fmt(presupuestoAnual!)})`,
    );
  }
  return {
    permitido: false,
    status,
    mensaje: `Esta solicitud excedería el presupuesto ${parts.join(' y ')} del área "${area.nombre}". El cálculo incluye solicitudes pendientes del área.`,
  };
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
  montoNuevo: number,
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
      COALESCE(SUM(c.monto_total), 0)::numeric AS gasto_anual,
      COALESCE(SUM(CASE WHEN c.fecha_compra >= ${startOfMonth} THEN c.monto_total ELSE 0 END), 0)::numeric AS gasto_mensual
    FROM compras c
    JOIN solicitudes s ON s.id = c.solicitud_id
    WHERE s.tenant_id = ${tenantId}
      AND s.centro_costo_id = ${centroCostoId}
      AND s.estado IN ('abonada', 'recibida_con_obs', 'cerrada')
      AND c.fecha_compra >= ${startOfYear}
  `;

  const gastoAnual = Number(gastos[0]?.gasto_anual ?? 0);
  const gastoMensual = Number(gastos[0]?.gasto_mensual ?? 0);

  const presupuestoAnual =
    centroCosto.presupuesto_anual != null ? Number(centroCosto.presupuesto_anual) : null;
  const presupuestoMensual =
    centroCosto.presupuesto_mensual != null ? Number(centroCosto.presupuesto_mensual) : null;

  const disponibleAnual = presupuestoAnual !== null ? presupuestoAnual - gastoAnual : null;
  const disponibleMensual = presupuestoMensual !== null ? presupuestoMensual - gastoMensual : null;

  // Check if new amount would exceed budget
  const excederiaAnual = disponibleAnual !== null && gastoAnual + montoNuevo > presupuestoAnual!;
  const excederiaMensual =
    disponibleMensual !== null && gastoMensual + montoNuevo > presupuestoMensual!;

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

  // This function reports `status.excedido` only. The hard block lives in
  // POST /api/compras so the check can combine area + centro de costo limits
  // and skip when only informational callers (aprobar) invoke it.
  return { permitido: true, status };
}

export interface AreaBudgetSummary {
  areaId: number;
  areaNombre: string;
  presupuestoMensual: number | null;
  presupuestoAnual: number | null;
  gastoMensual: number;
  gastoAnual: number;
  disponibleMensual: number | null;
  disponibleAnual: number | null;
  porcentajeMensual: number;
  porcentajeAnual: number;
}

export async function getResumenPresupuesto(tenantId: number): Promise<AreaBudgetSummary[]> {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const rows = await prisma.$queryRaw<
    {
      area_id: number;
      area_nombre: string;
      presupuesto_mensual: number | null;
      presupuesto_anual: number | null;
      gasto_mensual: number;
      gasto_anual: number;
    }[]
  >`
    SELECT
      a.id AS area_id,
      a.nombre AS area_nombre,
      a.presupuesto_mensual::numeric AS presupuesto_mensual,
      a.presupuesto_anual::numeric AS presupuesto_anual,
      COALESCE(SUM(CASE WHEN c.fecha_compra >= ${startOfMonth} THEN c.monto_total ELSE 0 END), 0)::numeric AS gasto_mensual,
      COALESCE(SUM(CASE WHEN c.fecha_compra >= ${startOfYear} THEN c.monto_total ELSE 0 END), 0)::numeric AS gasto_anual
    FROM areas a
    LEFT JOIN solicitudes s ON s.area_id = a.id AND s.tenant_id = a.tenant_id
      AND s.estado IN ('abonada', 'recibida_con_obs', 'cerrada')
    LEFT JOIN compras c ON c.solicitud_id = s.id AND c.tenant_id = s.tenant_id
      AND c.fecha_compra >= ${startOfYear}
    WHERE a.tenant_id = ${tenantId} AND a.activo = true
    GROUP BY a.id, a.nombre, a.presupuesto_mensual, a.presupuesto_anual
    ORDER BY a.nombre
  `;

  return rows.map((r) => {
    // numeric llega como string con el driver pg — convertir antes de exponer
    const pm = r.presupuesto_mensual != null ? Number(r.presupuesto_mensual) : null;
    const pa = r.presupuesto_anual != null ? Number(r.presupuesto_anual) : null;
    const gastoMensual = Number(r.gasto_mensual);
    const gastoAnual = Number(r.gasto_anual);
    return {
      areaId: r.area_id,
      areaNombre: r.area_nombre,
      presupuestoMensual: pm,
      presupuestoAnual: pa,
      gastoMensual,
      gastoAnual,
      disponibleMensual: pm !== null ? pm - gastoMensual : null,
      disponibleAnual: pa !== null ? pa - gastoAnual : null,
      porcentajeMensual: pm ? Math.round((gastoMensual / pm) * 100) : 0,
      porcentajeAnual: pa ? Math.round((gastoAnual / pa) * 100) : 0,
    };
  });
}
