import { getServerSession } from '@/lib/auth';
import { Prisma } from '@/app/generated/prisma/client';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { getEffectiveTenantId } from '@/lib/tenant-override';
import { cached } from '@/lib/cache';

export async function GET(request: Request) {
  try {
    const { session, effectiveTenantId } = await getEffectiveTenantId(request);
    const db = effectiveTenantId ? tenantPrisma(effectiveTenantId) : prisma;
    const { userId, areaId, roles } = session;
    const tenantId = effectiveTenantId;
    const result: any = {};
    const semanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const inicioAño = new Date(new Date().getFullYear(), 0, 1);
    const hace90Dias = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Director area filter from query params (optional)
    const { searchParams } = new URL(request.url);
    const directorAreaParam = searchParams.get('directorAreaId');
    const directorAreaId = directorAreaParam ? Number(directorAreaParam) : null;

    // Provide list of areas for director selector
    if (roles.includes('director')) {
      const areas = await db.areas.findMany({
        where: { activo: true },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      });
      result.areasDisponibles = areas;
    }

    // ── Solicitante section ──
    if (roles.includes('solicitante')) {
      const [
        misSolicitudes,
        solicitudesEnEjecucion,
        solicitudesDevueltas,
        recepcionesPendientes,
        solicitudesMesSolicitante,
        montoSolicitadoMes,
        tasaAprobacionData,
        misSolicitudesPorEstado,
      ] = await Promise.all([
        db.solicitudes.findMany({
          where: { solicitante_id: userId, estado: { notIn: ['rechazada', 'cerrada', 'anulada'] } },
          orderBy: { created_at: 'desc' },
          take: 5,
          select: { id: true, numero: true, titulo: true, estado: true, urgencia: true, created_at: true },
        }),
        db.solicitudes.count({
          where: { solicitante_id: userId, estado: { in: ['aprobada', 'en_compras', 'pago_programado', 'comprada'] } },
        }),
        db.solicitudes.count({
          where: { solicitante_id: userId, estado: { in: ['devuelta_resp', 'devuelta_dir'] } },
        }),
        db.solicitudes.count({
          where: { solicitante_id: userId, estado: 'comprada' },
        }),
        db.solicitudes.count({
          where: { solicitante_id: userId, created_at: { gte: inicioMes } },
        }),
        db.solicitudes.aggregate({
          where: { solicitante_id: userId, created_at: { gte: inicioMes } },
          _sum: { monto_estimado_total: true },
        }),
        // Tasa de aprobación: last 90 days
        Promise.all([
          db.solicitudes.count({
            where: {
              solicitante_id: userId,
              created_at: { gte: hace90Dias },
              estado: { in: ['aprobada', 'comprada', 'cerrada', 'en_compras', 'pago_programado', 'recibida', 'recibida_con_obs'] },
            },
          }),
          db.solicitudes.count({
            where: {
              solicitante_id: userId,
              created_at: { gte: hace90Dias },
              estado: { notIn: ['borrador'] },
            },
          }),
        ]),
        // Mis solicitudes por estado (active)
        prisma.$queryRaw<{ estado: string; cantidad: string }[]>`
          SELECT estado, COUNT(*)::text AS cantidad
          FROM solicitudes
          WHERE tenant_id = ${tenantId}
            AND solicitante_id = ${userId}
            AND estado NOT IN ('cerrada', 'anulada')
          GROUP BY estado
          ORDER BY cantidad DESC
        `,
      ]);
      const [aprobadas90d, total90d] = tasaAprobacionData;
      result.misSolicitudes = misSolicitudes;
      result.solicitudesEnEjecucion = solicitudesEnEjecucion;
      result.solicitudesDevueltas = solicitudesDevueltas;
      result.recepcionesPendientes = recepcionesPendientes;
      result.solicitudesMesSolicitante = solicitudesMesSolicitante;
      result.montoSolicitadoMes = Number(montoSolicitadoMes._sum.monto_estimado_total ?? 0);
      result.tasaAprobacion = total90d > 0 ? Math.round((aprobadas90d / total90d) * 100) : 0;
      result.misSolicitudesPorEstado = misSolicitudesPorEstado.map(r => ({
        estado: r.estado,
        cantidad: parseInt(r.cantidad),
      }));
    }

    // ── Responsable de área section ──
    if (roles.includes('responsable_area') && areaId) {
      const [
        pendientesValidar,
        solicitudesArea,
        solicitudesAreaMes,
        devueltasArea,
        gastoAreaData,
        solicitudesAreaPorEstado,
      ] = await Promise.all([
        db.solicitudes.count({
          where: { area_id: areaId, estado: 'enviada' },
        }),
        db.solicitudes.findMany({
          where: { area_id: areaId },
          orderBy: { created_at: 'desc' },
          take: 10,
          select: { id: true, numero: true, titulo: true, estado: true, urgencia: true, created_at: true },
        }),
        db.solicitudes.count({
          where: { area_id: areaId, created_at: { gte: inicioMes } },
        }),
        db.solicitudes.count({
          where: { area_id: areaId, estado: { in: ['devuelta_resp', 'devuelta_dir'] } },
        }),
        // Gasto del área mes y año
        Promise.all([
          prisma.$queryRaw<{ total: string }[]>`
            SELECT COALESCE(SUM(c.monto_total), 0)::text AS total
            FROM compras c
            JOIN solicitudes s ON c.solicitud_id = s.id AND c.tenant_id = s.tenant_id
            WHERE c.tenant_id = ${tenantId} AND s.area_id = ${areaId} AND c.fecha_compra >= ${inicioMes}
          `,
          prisma.$queryRaw<{ total: string }[]>`
            SELECT COALESCE(SUM(c.monto_total), 0)::text AS total
            FROM compras c
            JOIN solicitudes s ON c.solicitud_id = s.id AND c.tenant_id = s.tenant_id
            WHERE c.tenant_id = ${tenantId} AND s.area_id = ${areaId} AND c.fecha_compra >= ${inicioAño}
          `,
        ]),
        prisma.$queryRaw<{ estado: string; cantidad: string }[]>`
          SELECT estado, COUNT(*)::text AS cantidad
          FROM solicitudes
          WHERE tenant_id = ${tenantId} AND area_id = ${areaId}
            AND estado NOT IN ('cerrada', 'anulada')
          GROUP BY estado
          ORDER BY cantidad DESC
        `,
      ]);
      const [gastoAreaMesRaw, gastoAreaAñoRaw] = gastoAreaData;
      result.pendientesValidar = pendientesValidar;
      result.solicitudesArea = solicitudesArea;
      result.solicitudesAreaMes = solicitudesAreaMes;
      result.devueltasArea = devueltasArea;
      result.gastoAreaMes = parseFloat(gastoAreaMesRaw[0]?.total ?? '0');
      result.gastoAreaAño = parseFloat(gastoAreaAñoRaw[0]?.total ?? '0');
      result.solicitudesAreaPorEstado = solicitudesAreaPorEstado.map(r => ({
        estado: r.estado,
        cantidad: parseInt(r.cantidad),
      }));
    }

    // ── Director section ──
    if (roles.includes('director')) {
      // Director can pick an area to filter, or see all (default)
      const dirAreaFilter = directorAreaId ? { area_id: directorAreaId } : {};
      const areaFilter = dirAreaFilter;
      const [pendientesAprobar, aprobadasSemana, rechazadasSemana, montoPendienteAprobar, urgentesPendientes] = await Promise.all([
        db.solicitudes.count({ where: { estado: 'validada', ...areaFilter } }),
        db.solicitudes.count({ where: { fecha_aprobacion: { gte: semanaAtras }, ...areaFilter } }),
        db.solicitudes.count({ where: { fecha_rechazo: { gte: semanaAtras }, ...areaFilter } }),
        db.solicitudes.aggregate({
          where: { estado: 'validada', ...areaFilter },
          _sum: { monto_estimado_total: true },
        }),
        db.solicitudes.count({
          where: { estado: 'validada', urgencia: { in: ['urgente', 'critica'] }, ...areaFilter },
        }),
      ]);
      result.pendientesAprobar = pendientesAprobar;
      result.aprobadasSemana = aprobadasSemana;
      result.rechazadasSemana = rechazadasSemana;
      result.montoPendienteAprobar = Number(montoPendienteAprobar._sum.monto_estimado_total ?? 0);
      result.urgentesPendientesDir = urgentesPendientes;
    }

    // ── Compras section (cross-area — sees all solicitudes) ──
    if (roles.includes('compras')) {
      const areaFilter = {};
      const [solicitudesAprobadas, solicitudesEnCompras, pagoProgramado, urgentesPipeline] = await Promise.all([
        db.solicitudes.count({ where: { estado: 'aprobada', ...areaFilter } }),
        db.solicitudes.count({ where: { estado: 'en_compras', ...areaFilter } }),
        db.solicitudes.count({ where: { estado: 'pago_programado', ...areaFilter } }),
        db.solicitudes.count({
          where: { estado: { in: ['aprobada', 'en_compras'] }, urgencia: { in: ['urgente', 'critica'] }, ...areaFilter },
        }),
      ]);
      const pipeline = await db.solicitudes.findMany({
        where: { estado: { in: ['aprobada', 'en_compras', 'pago_programado'] }, ...areaFilter },
        orderBy: { created_at: 'desc' },
        take: 10,
        select: { id: true, numero: true, titulo: true, estado: true, urgencia: true, prioridad_compra: true, dia_pago_programado: true, monto_estimado_total: true },
      });
      // Tiempo promedio pipeline (last 90 days)
      const tiempoPipeline = await prisma.$queryRaw<{ avg_days: string | null }[]>`
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (c.fecha_compra::timestamp - s.fecha_aprobacion::timestamp)) / 86400))::text AS avg_days
        FROM compras c
        JOIN solicitudes s ON c.solicitud_id = s.id AND c.tenant_id = s.tenant_id
        WHERE c.tenant_id = ${tenantId}
          AND s.fecha_aprobacion IS NOT NULL
          AND c.fecha_compra >= ${hace90Dias}
      `;
      result.solicitudesAprobadas = solicitudesAprobadas;
      result.solicitudesEnCompras = solicitudesEnCompras;
      result.pagoProgramado = pagoProgramado;
      result.urgentesPipeline = urgentesPipeline;
      result.pipeline = pipeline;
      result.tiempoPromedioPipeline = parseInt(tiempoPipeline[0]?.avg_days ?? '0') || 0;
    }

    // ── Tesorería section (cross-area — sees all solicitudes) ──
    if (roles.includes('tesoreria')) {
      const areaFilter = {};
      const proximaSemanaDias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [pendientesComprar, recepcionesConObs, pagoProgramadoProximo, ultimasCompras, montoPagosProximos, comprasSinRecepcion] = await Promise.all([
        db.solicitudes.count({ where: { estado: { in: ['aprobada', 'pago_programado'] }, ...areaFilter } }),
        db.solicitudes.count({ where: { estado: 'recibida_con_obs', ...areaFilter } }),
        db.solicitudes.count({ where: { estado: 'pago_programado', dia_pago_programado: { gte: new Date(), lte: proximaSemanaDias }, ...areaFilter } }),
        db.compras.findMany({
          orderBy: { created_at: 'desc' },
          take: 5,
          include: { solicitud: { select: { numero: true, titulo: true } } },
        }),
        // Monto de pagos próximos 7 días
        db.solicitudes.aggregate({
          where: { estado: 'pago_programado', dia_pago_programado: { gte: new Date(), lte: proximaSemanaDias }, ...areaFilter },
          _sum: { monto_estimado_total: true },
        }),
        // Compras sin recepción
        prisma.$queryRaw<{ cantidad: string }[]>`
          SELECT COUNT(*)::text AS cantidad
          FROM solicitudes s
          WHERE s.tenant_id = ${tenantId}
            AND s.estado = 'comprada'
            AND NOT EXISTS (SELECT 1 FROM recepciones r WHERE r.solicitud_id = s.id AND r.tenant_id = s.tenant_id)
        `,
      ]);
      result.pendientesComprar = pendientesComprar;
      result.recepcionesConObs = recepcionesConObs;
      result.pagoProgramadoProximo = pagoProgramadoProximo;
      result.ultimasCompras = ultimasCompras;
      result.montoPagosProximos = Number(montoPagosProximos._sum.monto_estimado_total ?? 0);
      result.comprasSinRecepcion = parseInt(comprasSinRecepcion[0]?.cantidad ?? '0');
    }

    // ── Admin section (platform-level metrics) ──
    if (roles.includes('admin')) {
      const [
        totalOrganizaciones,
        orgActivas,
        orgPendientes,
        orgSuspendidas,
        totalUsuariosPlataforma,
        usuariosNuevosMes,
        registrosMesData,
        orgsPorActividad,
      ] = await Promise.all([
        prisma.tenants.count(),
        prisma.tenants.count({ where: { estado: 'activo', desactivado: false } }),
        prisma.tenants.count({ where: { estado: 'pendiente' } }),
        prisma.tenants.count({ where: { OR: [{ estado: 'suspendido' }, { desactivado: true }] } }),
        prisma.usuarios.count({ where: { activo: true } }),
        prisma.usuarios.count({ where: { created_at: { gte: inicioMes } } }),
        // Registros por mes (últimos 6 meses)
        prisma.$queryRaw<{ mes: string; cantidad: string }[]>`
          SELECT TO_CHAR(fecha_registro, 'YYYY-MM') AS mes, COUNT(*)::text AS cantidad
          FROM tenants
          WHERE fecha_registro >= (CURRENT_DATE - INTERVAL '6 months')
          GROUP BY TO_CHAR(fecha_registro, 'YYYY-MM')
          ORDER BY mes ASC
        `,
        // Top 5 orgs por actividad (solicitudes este mes)
        prisma.$queryRaw<{ org: string; usuarios: string; solicitudes: string; compras_total: string }[]>`
          SELECT t.nombre AS org,
                 (SELECT COUNT(*)::text FROM usuarios u WHERE u.tenant_id = t.id AND u.activo = true) AS usuarios,
                 (SELECT COUNT(*)::text FROM solicitudes s WHERE s.tenant_id = t.id AND s.created_at >= ${inicioMes}) AS solicitudes,
                 (SELECT COALESCE(SUM(c.monto_total), 0)::text FROM compras c WHERE c.tenant_id = t.id AND c.fecha_compra >= ${inicioMes}) AS compras_total
          FROM tenants t
          WHERE t.estado = 'activo' AND t.desactivado = false
          ORDER BY (SELECT COUNT(*) FROM solicitudes s WHERE s.tenant_id = t.id AND s.created_at >= ${inicioMes}) DESC
          LIMIT 5
        `,
      ]);

      result.adminPlatform = {
        totalOrganizaciones,
        orgActivas,
        orgPendientes,
        orgSuspendidas,
        totalUsuariosPlataforma,
        usuariosNuevosMes,
        registrosMes: registrosMesData.map(r => ({ mes: r.mes, cantidad: parseInt(r.cantidad) })),
        orgsPorActividad: orgsPorActividad.map(r => ({
          org: r.org,
          usuarios: parseInt(r.usuarios),
          solicitudes: parseInt(r.solicitudes),
          comprasTotal: parseFloat(r.compras_total),
        })),
      };
    }

    // ── Analytics (director, tesoreria, compras — NOT admin, who has platform-level metrics) ──
    const hasAnalytics = roles.includes('director') || roles.includes('tesoreria') || roles.includes('compras');
    if (hasAnalytics) {
      // Area filter for director — applied to analytics queries
      const areaJoinFilter = directorAreaId
        ? Prisma.sql`JOIN solicitudes sf ON c.solicitud_id = sf.id AND c.tenant_id = sf.tenant_id AND sf.area_id = ${directorAreaId}`
        : Prisma.empty;
      const areaWhereFilter = directorAreaId
        ? Prisma.sql`AND s.area_id = ${directorAreaId}`
        : Prisma.empty;
      // For tendencia query (no s alias, needs join)
      const tendenciaAreaJoin = directorAreaId
        ? Prisma.sql`JOIN solicitudes s ON c.solicitud_id = s.id AND c.tenant_id = s.tenant_id`
        : Prisma.empty;
      const tendenciaAreaWhere = directorAreaId
        ? Prisma.sql`AND s.area_id = ${directorAreaId}`
        : Prisma.empty;

      const analyticsData = await cached(
        `t:${tenantId}:dashboard:analytics:${directorAreaId ?? 'all'}`,
        2 * 60 * 1000, // 2 min TTL
        async () => {
          const [gastoAnual, gastoMensual, gastoPorArea, tendenciaMensual, gastoPorMedioPago, topProveedores, solicitudesPorEstado, solicitudesPorUrgencia] = await Promise.all([
            prisma.$queryRaw<{ total: string | null }[]>`
              SELECT COALESCE(SUM(c.monto_total), 0)::text AS total
              FROM compras c
              ${areaJoinFilter}
              WHERE c.tenant_id = ${tenantId} AND c.fecha_compra >= ${inicioAño}
            `,
            prisma.$queryRaw<{ total: string | null }[]>`
              SELECT COALESCE(SUM(c.monto_total), 0)::text AS total
              FROM compras c
              ${areaJoinFilter}
              WHERE c.tenant_id = ${tenantId} AND c.fecha_compra >= ${inicioMes}
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
                AND c.fecha_compra >= (CURRENT_DATE - INTERVAL '6 months')
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
              ORDER BY cantidad DESC
            `,
            prisma.$queryRaw<{ urgencia: string; cantidad: string }[]>`
              SELECT urgencia, COUNT(*)::text AS cantidad
              FROM solicitudes
              WHERE tenant_id = ${tenantId} AND created_at >= ${inicioAño}
              GROUP BY urgencia
            `,
          ]);
          return { gastoAnual, gastoMensual, gastoPorArea, tendenciaMensual, gastoPorMedioPago, topProveedores, solicitudesPorEstado, solicitudesPorUrgencia };
        }
      );

      const { gastoAnual, gastoMensual, gastoPorArea, tendenciaMensual, gastoPorMedioPago, topProveedores, solicitudesPorEstado, solicitudesPorUrgencia } = analyticsData;
      result.gastoAnual = parseFloat(gastoAnual[0]?.total ?? '0');
      result.gastoMensual = parseFloat(gastoMensual[0]?.total ?? '0');
      result.gastoPorArea = gastoPorArea.map(r => ({
        area: r.area_nombre,
        total: parseFloat(r.total),
        cantidad: parseInt(r.cantidad),
      }));
      result.tendenciaMensual = tendenciaMensual.map(r => ({
        mes: r.mes,
        total: parseFloat(r.total),
        cantidad: parseInt(r.cantidad),
      }));
      result.gastoPorMedioPago = gastoPorMedioPago.map(r => ({
        medioPago: r.medio_pago,
        total: parseFloat(r.total),
        cantidad: parseInt(r.cantidad),
      }));
      result.topProveedores = topProveedores.map(r => ({
        proveedor: r.proveedor,
        total: parseFloat(r.total),
        cantidad: parseInt(r.cantidad),
      }));
      result.solicitudesPorEstado = solicitudesPorEstado.map(r => ({
        estado: r.estado,
        cantidad: parseInt(r.cantidad),
      }));
      result.solicitudesPorUrgencia = solicitudesPorUrgencia.map(r => ({
        urgencia: r.urgencia,
        cantidad: parseInt(r.cantidad),
      }));
    }

    return Response.json(result);
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
