import { prisma } from '@/lib/prisma';
import type { DashboardContext } from './context';

export async function getComprasData(ctx: DashboardContext) {
  const { tdb, tenantId, dates } = ctx;
  const { hace90Dias } = dates;

  const [solicitudesAprobadas, solicitudesEnCompras, pagoProgramado, urgentesPipeline] =
    await Promise.all([
      tdb.solicitudes.count({ where: { estado: 'aprobada' } }),
      tdb.solicitudes.count({ where: { estado: 'en_compras' } }),
      tdb.solicitudes.count({ where: { estado: 'pago_programado' } }),
      tdb.solicitudes.count({
        where: {
          estado: { in: ['aprobada', 'en_compras'] },
          urgencia: { in: ['urgente', 'critica'] },
        },
      }),
    ]);

  const pipeline = await tdb.solicitudes.findMany({
    where: { estado: { in: ['aprobada', 'en_compras', 'pago_programado'] } },
    orderBy: { created_at: 'desc' },
    take: 10,
    select: {
      id: true,
      numero: true,
      titulo: true,
      estado: true,
      urgencia: true,
      prioridad_compra: true,
      dia_pago_programado: true,
    },
  });

  const tiempoPipeline = await prisma.$queryRaw<{ avg_days: string | null }[]>`
    -- fecha_compra is a DATE; cast fecha_aprobacion to ::date for whole-day
    -- diffs instead of negative fractional days on same-day purchases.
    SELECT ROUND(AVG(c.fecha_compra - s.fecha_aprobacion::date))::text AS avg_days
    FROM compras c
    JOIN solicitudes s ON c.solicitud_id = s.id AND c.tenant_id = s.tenant_id
    WHERE c.tenant_id = ${tenantId}
      AND s.fecha_aprobacion IS NOT NULL
      AND c.fecha_compra >= ${hace90Dias}
  `;

  return {
    solicitudesAprobadas,
    solicitudesEnCompras,
    pagoProgramado,
    urgentesPipeline,
    pipeline,
    tiempoPromedioPipeline: parseInt(tiempoPipeline[0]?.avg_days ?? '0') || 0,
  };
}
