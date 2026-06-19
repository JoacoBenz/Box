import { prisma } from '@/lib/prisma';
import type { DashboardContext } from './context';

export async function getSolicitanteData(ctx: DashboardContext) {
  const { tdb, tenantId, userId, dates } = ctx;
  const { inicioMes, hace90Dias } = dates;

  const [
    misSolicitudes,
    solicitudesEnEjecucion,
    solicitudesDevueltas,
    recepcionesPendientes,
    solicitudesMesSolicitante,
    tasaAprobacionData,
    misSolicitudesPorEstado,
  ] = await Promise.all([
    tdb.solicitudes.findMany({
      where: { solicitante_id: userId, estado: { notIn: ['rechazada', 'cerrada', 'anulada'] } },
      orderBy: { created_at: 'desc' },
      take: 5,
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
      where: {
        solicitante_id: userId,
        estado: { in: ['aprobada', 'en_compras', 'pago_programado', 'abonada'] },
      },
    }),
    tdb.solicitudes.count({
      where: { solicitante_id: userId, estado: { in: ['devuelta_resp', 'devuelta_dir'] } },
    }),
    tdb.solicitudes.count({
      where: { solicitante_id: userId, estado: 'abonada' },
    }),
    tdb.solicitudes.count({
      where: { solicitante_id: userId, created_at: { gte: inicioMes } },
    }),
    Promise.all([
      tdb.solicitudes.count({
        where: {
          solicitante_id: userId,
          created_at: { gte: hace90Dias },
          estado: {
            in: [
              'aprobada',
              'abonada',
              'cerrada',
              'en_compras',
              'pago_programado',
              'recibida_con_obs',
            ],
          },
        },
      }),
      tdb.solicitudes.count({
        where: {
          solicitante_id: userId,
          created_at: { gte: hace90Dias },
          estado: { notIn: ['borrador'] },
        },
      }),
    ]),
    prisma.$queryRaw<{ estado: string; cantidad: string }[]>`
      SELECT estado, COUNT(*)::text AS cantidad
      FROM solicitudes
      WHERE tenant_id = ${tenantId}
        AND solicitante_id = ${userId}
        AND estado NOT IN ('cerrada', 'anulada')
      GROUP BY estado
      ORDER BY COUNT(*) DESC
    `,
  ]);

  const [aprobadas90d, total90d] = tasaAprobacionData;

  return {
    misSolicitudes,
    solicitudesEnEjecucion,
    solicitudesDevueltas,
    recepcionesPendientes,
    solicitudesMesSolicitante,
    tasaAprobacion: total90d > 0 ? Math.round((aprobadas90d / total90d) * 100) : 0,
    misSolicitudesPorEstado: misSolicitudesPorEstado.map(
      (r: { estado: string; cantidad: string }) => ({
        estado: r.estado,
        cantidad: parseInt(r.cantidad),
      }),
    ),
  };
}
