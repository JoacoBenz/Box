import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession();
    const db = tenantPrisma(session.tenantId);
    const { userId, areaId, roles, tenantId } = session;
    const result: any = {};
    const semanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const inicioAño = new Date(new Date().getFullYear(), 0, 1);

    // ── Solicitante section ──
    if (roles.includes('solicitante')) {
      result.misSolicitudes = await db.solicitudes.findMany({
        where: { solicitante_id: userId, estado: { notIn: ['rechazada', 'cerrada'] } },
        orderBy: { created_at: 'desc' },
        take: 5,
        select: { id: true, numero: true, titulo: true, estado: true, urgencia: true, created_at: true },
      });
      result.solicitudesEnEjecucion = await db.solicitudes.count({
        where: { solicitante_id: userId, estado: { in: ['aprobada', 'en_compras', 'pago_programado', 'comprada'] } },
      });
    }

    // ── Responsable de área section ──
    if (roles.includes('responsable_area') && areaId) {
      result.pendientesValidar = await db.solicitudes.count({
        where: { area_id: areaId, estado: 'enviada' },
      });
      result.solicitudesArea = await db.solicitudes.findMany({
        where: { area_id: areaId },
        orderBy: { created_at: 'desc' },
        take: 10,
        select: { id: true, numero: true, titulo: true, estado: true, urgencia: true, created_at: true },
      });
    }

    // ── Director section ──
    if (roles.includes('director')) {
      const areaFilter = areaId ? { area_id: areaId } : {};
      const [pendientesAprobar, aprobadasSemana, rechazadasSemana, solicitudesAprobadas] = await Promise.all([
        db.solicitudes.count({ where: { estado: 'validada', ...areaFilter } }),
        db.solicitudes.count({ where: { estado: 'aprobada', fecha_aprobacion: { gte: semanaAtras }, ...areaFilter } }),
        db.solicitudes.count({ where: { estado: 'rechazada', fecha_rechazo: { gte: semanaAtras }, ...areaFilter } }),
        db.solicitudes.count({ where: { estado: 'aprobada', ...areaFilter } }),
      ]);
      result.pendientesAprobar = pendientesAprobar;
      result.aprobadasSemana = aprobadasSemana;
      result.rechazadasSemana = rechazadasSemana;
      result.solicitudesAprobadas = solicitudesAprobadas;
    }

    // ── Compras section ──
    if (roles.includes('compras')) {
      const areaFilter = areaId ? { area_id: areaId } : {};
      const [solicitudesAprobadas, solicitudesEnCompras, pagoProgramado] = await Promise.all([
        db.solicitudes.count({ where: { estado: 'aprobada', ...areaFilter } }),
        db.solicitudes.count({ where: { estado: 'en_compras', ...areaFilter } }),
        db.solicitudes.count({ where: { estado: 'pago_programado', ...areaFilter } }),
      ]);
      const pipeline = await db.solicitudes.findMany({
        where: { estado: { in: ['aprobada', 'en_compras', 'pago_programado'] }, ...areaFilter },
        orderBy: { created_at: 'desc' },
        take: 10,
        select: { id: true, numero: true, titulo: true, estado: true, urgencia: true, prioridad_compra: true, dia_pago_programado: true, monto_estimado_total: true },
      });
      result.solicitudesAprobadas = solicitudesAprobadas;
      result.solicitudesEnCompras = solicitudesEnCompras;
      result.pagoProgramado = pagoProgramado;
      result.pipeline = pipeline;
    }

    // ── Tesorería section ──
    if (roles.includes('tesoreria')) {
      const areaFilter = areaId ? { area_id: areaId } : {};
      const proximaSemanaDias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [pendientesComprar, recepcionesConObs, pagoProgramadoProximo, ultimasCompras] = await Promise.all([
        db.solicitudes.count({ where: { estado: { in: ['aprobada', 'pago_programado'] }, ...areaFilter } }),
        db.solicitudes.count({ where: { estado: 'recibida_con_obs', ...areaFilter } }),
        db.solicitudes.count({ where: { estado: 'pago_programado', dia_pago_programado: { gte: new Date(), lte: proximaSemanaDias }, ...areaFilter } }),
        db.compras.findMany({
          where: areaId ? { solicitud: { area_id: areaId } } : {},
          orderBy: { created_at: 'desc' },
          take: 5,
          include: { solicitud: { select: { numero: true, titulo: true } } },
        }),
      ]);
      result.pendientesComprar = pendientesComprar;
      result.recepcionesConObs = recepcionesConObs;
      result.pagoProgramadoProximo = pagoProgramadoProximo;
      result.ultimasCompras = ultimasCompras;
    }

    // ── Admin section ──
    if (roles.includes('admin')) {
      const [totalUsuarios, totalAreas, solicitudesMes] = await Promise.all([
        db.usuarios.count({ where: { activo: true } }),
        db.areas.count({ where: { activo: true } }),
        db.solicitudes.count({ where: { created_at: { gte: inicioMes } } }),
      ]);
      result.totalUsuarios = totalUsuarios;
      result.totalAreas = totalAreas;
      result.solicitudesMes = solicitudesMes;
    }

    // ── Analytics (director, tesoreria, admin) ──
    if (roles.includes('director') || roles.includes('tesoreria') || roles.includes('admin')) {
      const gastoAnual = await prisma.$queryRaw<{ total: string | null }[]>`
        SELECT COALESCE(SUM(c.monto_total), 0)::text AS total
        FROM compras c
        WHERE c.tenant_id = ${tenantId} AND c.fecha_compra >= ${inicioAño}
      `;
      result.gastoAnual = parseFloat(gastoAnual[0]?.total ?? '0');

      const gastoMensual = await prisma.$queryRaw<{ total: string | null }[]>`
        SELECT COALESCE(SUM(c.monto_total), 0)::text AS total
        FROM compras c
        WHERE c.tenant_id = ${tenantId} AND c.fecha_compra >= ${inicioMes}
      `;
      result.gastoMensual = parseFloat(gastoMensual[0]?.total ?? '0');

      const gastoPorArea = await prisma.$queryRaw<{ area_nombre: string; total: string; cantidad: string }[]>`
        SELECT a.nombre AS area_nombre, COALESCE(SUM(c.monto_total), 0)::text AS total, COUNT(c.id)::text AS cantidad
        FROM compras c
        JOIN solicitudes s ON c.solicitud_id = s.id AND c.tenant_id = s.tenant_id
        JOIN areas a ON s.area_id = a.id AND s.tenant_id = a.tenant_id
        WHERE c.tenant_id = ${tenantId} AND c.fecha_compra >= ${inicioAño}
        GROUP BY a.nombre
        ORDER BY SUM(c.monto_total) DESC
      `;
      result.gastoPorArea = gastoPorArea.map(r => ({
        area: r.area_nombre,
        total: parseFloat(r.total),
        cantidad: parseInt(r.cantidad),
      }));

      const tendenciaMensual = await prisma.$queryRaw<{ mes: string; total: string; cantidad: string }[]>`
        SELECT TO_CHAR(c.fecha_compra, 'YYYY-MM') AS mes,
               COALESCE(SUM(c.monto_total), 0)::text AS total,
               COUNT(c.id)::text AS cantidad
        FROM compras c
        WHERE c.tenant_id = ${tenantId}
          AND c.fecha_compra >= (CURRENT_DATE - INTERVAL '6 months')
        GROUP BY TO_CHAR(c.fecha_compra, 'YYYY-MM')
        ORDER BY mes ASC
      `;
      result.tendenciaMensual = tendenciaMensual.map(r => ({
        mes: r.mes,
        total: parseFloat(r.total),
        cantidad: parseInt(r.cantidad),
      }));

      const gastoPorMedioPago = await prisma.$queryRaw<{ medio_pago: string; total: string; cantidad: string }[]>`
        SELECT c.medio_pago, COALESCE(SUM(c.monto_total), 0)::text AS total, COUNT(c.id)::text AS cantidad
        FROM compras c
        WHERE c.tenant_id = ${tenantId} AND c.fecha_compra >= ${inicioAño}
        GROUP BY c.medio_pago
        ORDER BY SUM(c.monto_total) DESC
      `;
      result.gastoPorMedioPago = gastoPorMedioPago.map(r => ({
        medioPago: r.medio_pago,
        total: parseFloat(r.total),
        cantidad: parseInt(r.cantidad),
      }));

      const topProveedores = await prisma.$queryRaw<{ proveedor: string; total: string; cantidad: string }[]>`
        SELECT c.proveedor_nombre AS proveedor, COALESCE(SUM(c.monto_total), 0)::text AS total, COUNT(c.id)::text AS cantidad
        FROM compras c
        WHERE c.tenant_id = ${tenantId} AND c.fecha_compra >= ${inicioAño}
        GROUP BY c.proveedor_nombre
        ORDER BY SUM(c.monto_total) DESC
        LIMIT 5
      `;
      result.topProveedores = topProveedores.map(r => ({
        proveedor: r.proveedor,
        total: parseFloat(r.total),
        cantidad: parseInt(r.cantidad),
      }));

      const solicitudesPorEstado = await prisma.$queryRaw<{ estado: string; cantidad: string }[]>`
        SELECT estado, COUNT(*)::text AS cantidad
        FROM solicitudes
        WHERE tenant_id = ${tenantId}
        GROUP BY estado
        ORDER BY cantidad DESC
      `;
      result.solicitudesPorEstado = solicitudesPorEstado.map(r => ({
        estado: r.estado,
        cantidad: parseInt(r.cantidad),
      }));

      const solicitudesPorUrgencia = await prisma.$queryRaw<{ urgencia: string; cantidad: string }[]>`
        SELECT urgencia, COUNT(*)::text AS cantidad
        FROM solicitudes
        WHERE tenant_id = ${tenantId} AND created_at >= ${inicioAño}
        GROUP BY urgencia
      `;
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
