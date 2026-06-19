import { Prisma } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { cached } from '@/lib/cache';
import type { DashboardContext } from './context';

export async function getAnalyticsData(ctx: DashboardContext) {
  const { tenantId, directorAreaId, dates } = ctx;
  const { inicioMes, inicioAño } = dates;

  const areaJoinFilter = directorAreaId
    ? Prisma.sql`JOIN solicitudes sf ON c.solicitud_id = sf.id AND c.tenant_id = sf.tenant_id AND sf.area_id = ${directorAreaId}`
    : Prisma.empty;
  const areaWhereFilter = directorAreaId
    ? Prisma.sql`AND s.area_id = ${directorAreaId}`
    : Prisma.empty;
  const tendenciaAreaJoin = directorAreaId
    ? Prisma.sql`JOIN solicitudes s ON c.solicitud_id = s.id AND c.tenant_id = s.tenant_id`
    : Prisma.empty;
  const tendenciaAreaWhere = directorAreaId
    ? Prisma.sql`AND s.area_id = ${directorAreaId}`
    : Prisma.empty;

  const analyticsData = await cached(
    `t:${tenantId}:dashboard:analytics:${directorAreaId ?? 'all'}`,
    2 * 60 * 1000,
    async () => {
      const [
        gastoAnualMensual,
        gastoPorArea,
        tendenciaMensual,
        gastoPorMedioPago,
        topProveedores,
        solicitudesPorEstado,
        solicitudesPorUrgencia,
      ] = await Promise.all([
        prisma.$queryRaw<{ total_anual: string | null; total_mensual: string | null }[]>`
          SELECT
            COALESCE(SUM(c.monto_total), 0)::text AS total_anual,
            COALESCE(SUM(CASE WHEN c.fecha_compra >= ${inicioMes} THEN c.monto_total ELSE 0 END), 0)::text AS total_mensual
          FROM compras c
          ${areaJoinFilter}
          WHERE c.tenant_id = ${tenantId} AND c.fecha_compra >= ${inicioAño}
        `,
        prisma.$queryRaw<{ area_nombre: string; total: string; cantidad: string }[]>`
          SELECT a.nombre AS area_nombre, COALESCE(SUM(c.monto_total), 0)::text AS total, COUNT(c.id)::text AS cantidad
          FROM compras c
          JOIN solicitudes s ON c.solicitud_id = s.id AND c.tenant_id = s.tenant_id
          JOIN areas a ON s.area_id = a.id AND s.tenant_id = a.tenant_id
          WHERE c.tenant_id = ${tenantId} AND c.fecha_compra >= ${inicioAño}
          ${areaWhereFilter}
          GROUP BY a.nombre
          ORDER BY SUM(c.monto_total) DESC
        `,
        prisma.$queryRaw<{ mes: string; total: string; cantidad: string }[]>`
          SELECT TO_CHAR(c.fecha_compra, 'YYYY-MM') AS mes,
                 COALESCE(SUM(c.monto_total), 0)::text AS total,
                 COUNT(c.id)::text AS cantidad
          FROM compras c
          ${tendenciaAreaJoin}
          WHERE c.tenant_id = ${tenantId}
            AND c.fecha_compra >= CURRENT_DATE - INTERVAL '6 months'
            ${tendenciaAreaWhere}
          GROUP BY TO_CHAR(c.fecha_compra, 'YYYY-MM')
          ORDER BY mes ASC
        `,
        prisma.$queryRaw<{ medio_pago: string; total: string; cantidad: string }[]>`
          SELECT c.medio_pago, COALESCE(SUM(c.monto_total), 0)::text AS total, COUNT(c.id)::text AS cantidad
          FROM compras c
          WHERE c.tenant_id = ${tenantId} AND c.fecha_compra >= ${inicioAño}
          GROUP BY c.medio_pago
          ORDER BY SUM(c.monto_total) DESC
        `,
        prisma.$queryRaw<{ proveedor: string; total: string; cantidad: string }[]>`
          SELECT c.proveedor_nombre AS proveedor, COALESCE(SUM(c.monto_total), 0)::text AS total, COUNT(c.id)::text AS cantidad
          FROM compras c
          WHERE c.tenant_id = ${tenantId} AND c.fecha_compra >= ${inicioAño}
          GROUP BY c.proveedor_nombre
          ORDER BY SUM(c.monto_total) DESC
          LIMIT 5
        `,
        prisma.$queryRaw<{ estado: string; cantidad: string }[]>`
          SELECT estado, COUNT(*)::text AS cantidad
          FROM solicitudes
          WHERE tenant_id = ${tenantId}
          GROUP BY estado
          ORDER BY COUNT(*) DESC
        `,
        prisma.$queryRaw<{ urgencia: string; cantidad: string }[]>`
          SELECT urgencia, COUNT(*)::text AS cantidad
          FROM solicitudes
          WHERE tenant_id = ${tenantId} AND created_at >= ${inicioAño}
          GROUP BY urgencia
        `,
      ]);
      return {
        gastoAnualMensual,
        gastoPorArea,
        tendenciaMensual,
        gastoPorMedioPago,
        topProveedores,
        solicitudesPorEstado,
        solicitudesPorUrgencia,
      };
    },
  );

  const {
    gastoAnualMensual,
    gastoPorArea,
    tendenciaMensual,
    gastoPorMedioPago,
    topProveedores,
    solicitudesPorEstado,
    solicitudesPorUrgencia,
  } = analyticsData;

  return {
    gastoAnual: parseFloat(gastoAnualMensual[0]?.total_anual ?? '0'),
    gastoMensual: parseFloat(gastoAnualMensual[0]?.total_mensual ?? '0'),
    gastoPorArea: gastoPorArea.map((r) => ({
      area: r.area_nombre,
      total: parseFloat(r.total),
      cantidad: parseInt(r.cantidad),
    })),
    tendenciaMensual: tendenciaMensual.map((r) => ({
      mes: r.mes,
      total: parseFloat(r.total),
      cantidad: parseInt(r.cantidad),
    })),
    gastoPorMedioPago: gastoPorMedioPago.map((r) => ({
      medioPago: r.medio_pago,
      total: parseFloat(r.total),
      cantidad: parseInt(r.cantidad),
    })),
    topProveedores: topProveedores.map((r) => ({
      proveedor: r.proveedor,
      total: parseFloat(r.total),
      cantidad: parseInt(r.cantidad),
    })),
    solicitudesPorEstado: solicitudesPorEstado.map((r) => ({
      estado: r.estado,
      cantidad: parseInt(r.cantidad),
    })),
    solicitudesPorUrgencia: solicitudesPorUrgencia.map((r) => ({
      urgencia: r.urgencia,
      cantidad: parseInt(r.cantidad),
    })),
  };
}
