import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { verificarRol, verificarSegregacion } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['director'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo directores pueden aprobar' } }, { status: 403 });
    }

    const { id } = await params;
    const solicitudId = parseInt(id);
    const db = tenantPrisma(session.tenantId);

    const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
    if (!solicitud) return Response.json({ error: { code: 'NOT_FOUND', message: 'No encontrada' } }, { status: 404 });
    if (solicitud.estado !== 'validada') {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Esta solicitud no está pendiente de aprobación' } }, { status: 400 });
    }

    const seg = verificarSegregacion(solicitud, session.userId, 'aprobar');
    if (!seg.permitido) return Response.json({ error: { code: 'FORBIDDEN', message: seg.motivo } }, { status: 403 });

    await db.solicitudes.update({
      where: { id: solicitudId },
      data: { estado: 'aprobada', aprobado_por_id: session.userId, fecha_aprobacion: new Date() },
    });

    const montoStr = solicitud.monto_estimado_total ? ` por $${solicitud.monto_estimado_total}` : '';
    await crearNotificacion({ tenantId: session.tenantId, destinatarioId: solicitud.solicitante_id, tipo: 'solicitud_aprobada', titulo: 'Tu solicitud fue aprobada', mensaje: `${session.nombre} aprobó: ${solicitud.titulo}. Tesorería la procesará en breve.`, solicitudId });
    await notificarPorRol(session.tenantId, 'tesoreria', 'Nueva compra para ejecutar', `Solicitud aprobada: ${solicitud.titulo}${montoStr}`, solicitudId);

    if (solicitud.validado_por_id) {
      const area = await prisma.areas.findFirst({ where: { id: solicitud.area_id, tenant_id: session.tenantId } });
      if (area?.responsable_id) {
        await crearNotificacion({ tenantId: session.tenantId, destinatarioId: area.responsable_id, tipo: 'solicitud_aprobada', titulo: 'Solicitud aprobada', mensaje: `La solicitud "${solicitud.titulo}" fue aprobada`, solicitudId });
      }
    }

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'aprobar_solicitud', entidad: 'solicitud', entidadId: solicitudId });
    return Response.json({ message: 'Solicitud aprobada' });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
