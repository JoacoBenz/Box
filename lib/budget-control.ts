import { tenantPrisma } from './prisma';

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

  // Sum approved/in-process solicitudes for this cost center
  const gastosAnuales = await db.compras.findMany({
    where: {
      solicitud: {
        centro_costo_id: centroCostoId,
        estado: { in: ['comprada', 'recibida', 'recibida_con_obs', 'cerrada'] },
      },
      fecha_compra: { gte: startOfYear },
    },
    select: { monto_total: true },
  });

  const gastosMensuales = await db.compras.findMany({
    where: {
      solicitud: {
        centro_costo_id: centroCostoId,
        estado: { in: ['comprada', 'recibida', 'recibida_con_obs', 'cerrada'] },
      },
      fecha_compra: { gte: startOfMonth },
    },
    select: { monto_total: true },
  });

  const gastoAnual = gastosAnuales.reduce((sum, c) => sum + Number(c.monto_total), 0);
  const gastoMensual = gastosMensuales.reduce((sum, c) => sum + Number(c.monto_total), 0);

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
