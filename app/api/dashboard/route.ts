import { getServerSession } from '@/lib/auth';
import { tenantPrisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession();
    const db = tenantPrisma(session.tenantId);
    const { userId, areaId, roles } = session;
    const result: any = {};
    const semanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    if (roles.includes('solicitante')) {
      result.misSolicitudes = await db.solicitudes.findMany({
        where: { solicitante_id: userId, estado: { notIn: ['rechazada', 'cerrada'] } },
        orderBy: { created_at: 'desc' },
        take: 5,
        select: { id: true, numero: true, titulo: true, estado: true, urgencia: true, created_at: true },
      });
      result.recepcionesPendientes = await db.solicitudes.count({
        where: { solicitante_id: userId, estado: 'comprada' },
      });
    }

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

    if (roles.includes('director')) {
      result.pendientesAprobar = await db.solicitudes.count({ where: { estado: 'validada' } });
      result.aprobadasSemana = await db.solicitudes.count({ where: { estado: 'aprobada', fecha_aprobacion: { gte: semanaAtras } } });
      result.rechazadasSemana = await db.solicitudes.count({ where: { estado: 'rechazada', fecha_rechazo: { gte: semanaAtras } } });
    }

    if (roles.includes('tesoreria')) {
      result.pendientesComprar = await db.solicitudes.count({ where: { estado: 'aprobada' } });
      result.ultimasCompras = await db.compras.findMany({
        orderBy: { created_at: 'desc' },
        take: 5,
        include: { solicitud: { select: { numero: true, titulo: true } } },
      });
      result.recepcionesConObs = await db.solicitudes.count({ where: { estado: 'recibida_con_obs' } });
    }

    if (roles.includes('admin')) {
      result.totalUsuarios = await db.usuarios.count({ where: { activo: true } });
      result.totalAreas = await db.areas.count({ where: { activo: true } });
      result.solicitudesMes = await db.solicitudes.count({ where: { created_at: { gte: inicioMes } } });
    }

    return Response.json(result);
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
