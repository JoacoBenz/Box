import { tenantPrisma, prisma } from './prisma';

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

  const presupuestoAnual = centroCosto.presupuesto_anual ? Number(centroCosto.presupuesto_anual) : null;
  const presupuestoMensual = centroCosto.presupuesto_mensual ? Number(centroCosto.presupuesto_mensual) : null;

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
