import { Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getResumenPresupuesto } from '@/lib/budget-control';
import type { DashboardContext } from './context';

export async function getDirectorAreas(ctx: DashboardContext) {
  return ctx.tdb.areas.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });
}

export async function getDirectorData(ctx: DashboardContext) {
  const { tdb, tenantId, directorAreaId, dates } = ctx;
  const { semanaAtras, inicioMes, inicioMesAnterior, inicioAño, inicioAñoAnterior, hace90Dias } =
    dates;

  const areaFilter = directorAreaId ? { area_id: directorAreaId } : {};

  const dirAreaSqlFilter = directorAreaId
    ? Prisma.sql`AND area_id = ${directorAreaId}`
    : Prisma.empty;
  const dirAreaJoinFilter = directorAreaId
    ? Prisma.sql`JOIN solicitudes sf ON c.solicitud_id = sf.id AND c.tenant_id = sf.tenant_id AND sf.area_id = ${directorAreaId}`
    : Prisma.empty;
  const dirAreaSqlFilterS = directorAreaId
    ? Prisma.sql`AND s.area_id = ${directorAreaId}`
    : Prisma.empty;

  const [pendientesAprobar, aprobadasSemana, rechazadasSemana, urgentesPendientes] =
    await Promise.all([
      tdb.solicitudes.count({ where: { estado: 'validada', ...areaFilter } }),
      tdb.solicitudes.count({ where: { fecha_aprobacion: { gte: semanaAtras }, ...areaFilter } }),
      tdb.solicitudes.count({ where: { fecha_rechazo: { gte: semanaAtras }, ...areaFilter } }),
      tdb.solicitudes.count({
        where: { estado: 'validada', urgencia: { in: ['urgente', 'critica'] }, ...areaFilter },
      }),
    ]);

  const [gastoMesAnteriorData, gastoAnualAnteriorData, pipelineData, topPendientes, cycleTimeData] =
    await Promise.all([
      prisma.$queryRaw<{ total_mes_anterior: string }[]>`
        SELECT COALESCE(SUM(c.monto_total), 0)::text AS total_mes_anterior
        FROM compras c
        ${dirAreaJoinFilter}
        WHERE c.tenant_id = ${tenantId}
          AND c.fecha_compra >= ${inicioMesAnterior}
          AND c.fecha_compra < ${inicioMes}
      `,
      prisma.$queryRaw<{ total_anual_anterior: string }[]>`
        SELECT COALESCE(SUM(c.monto_total), 0)::text AS total_anual_anterior
        FROM compras c
        ${dirAreaJoinFilter}
        WHERE c.tenant_id = ${tenantId}
          AND c.fecha_compra >= ${inicioAñoAnterior}
          AND c.fecha_compra < ${inicioAño}
      `,
      prisma.$queryRaw<{ estado: string; cantidad: string }[]>`
        SELECT estado, COUNT(*)::text AS cantidad
        FROM solicitudes
        WHERE tenant_id = ${tenantId}
          AND estado IN ('enviada', 'validada', 'aprobada', 'en_compras', 'pago_programado', 'abonada')
          ${dirAreaSqlFilter}
        GROUP BY estado
      `,
      tdb.solicitudes.findMany({
        where: { estado: 'validada', ...areaFilter },
        orderBy: [{ created_at: 'asc' }],
        take: 5,
        select: {
          id: true,
          numero: true,
          titulo: true,
          urgencia: true,
          updated_at: true,
          solicitante: { select: { nombre: true } },
          area: { select: { nombre: true } },
          items_solicitud: { select: { precio_estimado: true, cantidad: true } },
        },
      }),
      prisma.$queryRaw<
        {
          avg_total_days: string | null;
          avg_approval_days: string | null;
          avg_payment_days: string | null;
        }[]
      >`
        -- fecha_compra is a DATE (interpreted as midnight), so cast the
        -- timestamps to ::date for whole-day diffs instead of negative
        -- fractional days on same-day approvals/purchases.
        SELECT
          ROUND(AVG(c.fecha_compra - s.created_at::date))::text AS avg_total_days,
          ROUND(AVG(s.fecha_aprobacion::date - s.created_at::date))::text AS avg_approval_days,
          ROUND(AVG(c.fecha_compra - s.fecha_aprobacion::date))::text AS avg_payment_days
        FROM compras c
        JOIN solicitudes s ON c.solicitud_id = s.id AND c.tenant_id = s.tenant_id
        WHERE c.tenant_id = ${tenantId}
          AND s.fecha_aprobacion IS NOT NULL
          AND c.fecha_compra >= ${hace90Dias}
          ${dirAreaSqlFilterS}
      `,
    ]);

  const urgenciaOrder: Record<string, number> = { critica: 0, urgente: 1, normal: 2 };

  return {
    pendientesAprobar,
    aprobadasSemana,
    rechazadasSemana,
    urgentesPendientesDir: urgentesPendientes,
    gastoMesAnterior: parseFloat(gastoMesAnteriorData[0]?.total_mes_anterior ?? '0'),
    gastoAnualAnterior: parseFloat(gastoAnualAnteriorData[0]?.total_anual_anterior ?? '0'),
    pipeline: pipelineData.map((r: { estado: string; cantidad: string }) => ({
      estado: r.estado,
      cantidad: parseInt(r.cantidad),
    })),
    topPendientes: topPendientes.sort(
      (a: any, b: any) => (urgenciaOrder[a.urgencia] ?? 99) - (urgenciaOrder[b.urgencia] ?? 99),
    ),
    tiempoCiclo: {
      totalDias: parseInt(cycleTimeData[0]?.avg_total_days ?? '0') || 0,
      aprobacionDias: parseInt(cycleTimeData[0]?.avg_approval_days ?? '0') || 0,
      pagoDias: parseInt(cycleTimeData[0]?.avg_payment_days ?? '0') || 0,
    },
    resumenPresupuesto: await getResumenPresupuesto(tenantId),
  };
}
