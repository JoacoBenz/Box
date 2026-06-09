import { prisma } from '@/lib/prisma';
import { getResumenPresupuesto } from '@/lib/budget-control';
import type { DashboardContext } from './context';

export async function getTesoreriaData(ctx: DashboardContext) {
  const { tdb, tenantId } = ctx;
  const proximaSemanaDias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [
    pendientesComprar,
    recepcionesConObs,
    pagoProgramadoProximo,
    ultimasCompras,
    comprasSinRecepcion,
  ] = await Promise.all([
    tdb.solicitudes.count({
      where: { estado: { in: ['aprobada', 'pago_programado'] } },
    }),
    tdb.solicitudes.count({ where: { estado: 'recibida_con_obs' } }),
    tdb.solicitudes.count({
      where: {
        estado: 'pago_programado',
        dia_pago_programado: { gte: new Date(), lte: proximaSemanaDias },
      },
    }),
    tdb.compras.findMany({
      orderBy: { created_at: 'desc' },
      take: 5,
      include: { solicitud: { select: { numero: true, titulo: true } } },
    }),
    prisma.$queryRaw<{ cantidad: string }[]>`
      SELECT COUNT(*)::text AS cantidad
      FROM solicitudes s
      WHERE s.tenant_id = ${tenantId}
        AND s.estado = 'abonada'
        AND NOT EXISTS (SELECT 1 FROM recepciones r WHERE r.solicitud_id = s.id AND r.tenant_id = s.tenant_id)
    `,
  ]);

  return {
    pendientesComprar,
    recepcionesConObs,
    pagoProgramadoProximo,
    ultimasCompras,
    comprasSinRecepcion: parseInt(comprasSinRecepcion[0]?.cantidad ?? '0'),
  };
}

export async function getTesoreriaBudget(tenantId: number) {
  return { resumenPresupuesto: await getResumenPresupuesto(tenantId) };
}
