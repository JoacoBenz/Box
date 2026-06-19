import { prisma } from '@/lib/prisma';
import type { DashboardContext } from './context';

export async function getResponsableAreaData(ctx: DashboardContext) {
  const { tdb, tenantId, areaId, dates } = ctx;
  if (!areaId) return null;

  const { inicioMes, inicioAño } = dates;

  const [
    pendientesValidar,
    solicitudesArea,
    solicitudesAreaMes,
    devueltasArea,
    gastoAreaData,
    solicitudesAreaPorEstado,
  ] = await Promise.all([
    tdb.solicitudes.count({
      where: { area_id: areaId, estado: 'enviada' },
    }),
    tdb.solicitudes.findMany({
      where: { area_id: areaId },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        id: true,
        numero: true,
        titulo: true,
        estado: true,
        urgencia: true,
        created_at: true,
      },
    }),
    tdb.solicitudes.count({
      where: { area_id: areaId, created_at: { gte: inicioMes } },
    }),
    tdb.solicitudes.count({
      where: { area_id: areaId, estado: { in: ['devuelta_resp', 'devuelta_dir'] } },
    }),
    prisma.$queryRaw<{ total_mes: string; total_anio: string }[]>`
      SELECT
        COALESCE(SUM(CASE WHEN c.fecha_compra >= ${inicioMes} THEN c.monto_total ELSE 0 END), 0)::text AS total_mes,
        COALESCE(SUM(c.monto_total), 0)::text AS total_anio
      FROM compras c
      JOIN solicitudes s ON c.solicitud_id = s.id AND c.tenant_id = s.tenant_id
      WHERE c.tenant_id = ${tenantId} AND s.area_id = ${areaId} AND c.fecha_compra >= ${inicioAño}
    `,
    prisma.$queryRaw<{ estado: string; cantidad: string }[]>`
      SELECT estado, COUNT(*)::text AS cantidad
      FROM solicitudes
      WHERE tenant_id = ${tenantId} AND area_id = ${areaId}
        AND estado NOT IN ('cerrada', 'anulada')
      GROUP BY estado
      ORDER BY COUNT(*) DESC
    `,
  ]);

  return {
    pendientesValidar,
    solicitudesArea,
    solicitudesAreaMes,
    devueltasArea,
    gastoAreaMes: parseFloat(gastoAreaData[0]?.total_mes ?? '0'),
    gastoAreaAño: parseFloat(gastoAreaData[0]?.total_anio ?? '0'),
    solicitudesAreaPorEstado: solicitudesAreaPorEstado.map(
      (r: { estado: string; cantidad: string }) => ({
        estado: r.estado,
        cantidad: parseInt(r.cantidad),
      }),
    ),
  };
}
