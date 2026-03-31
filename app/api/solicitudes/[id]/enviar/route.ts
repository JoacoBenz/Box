import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';
import { getTenantConfigBool } from '@/lib/tenant-config';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    const { id } = await params;
    const solicitudId = parseInt(id);
    const db = tenantPrisma(session.tenantId);

    const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId }, include: { items_solicitud: true } });
    if (!solicitud) return Response.json({ error: { code: 'NOT_FOUND', message: 'No encontrada' } }, { status: 404 });
    if (!['borrador', 'devuelta_resp', 'devuelta_dir'].includes(solicitud.estado)) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Solo se pueden enviar solicitudes en borrador o devueltas' } }, { status: 400 });
    }
    if (solicitud.solicitante_id !== session.userId) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo el solicitante puede enviar' } }, { status: 403 });
    }
    if (solicitud.items_solicitud.length === 0) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'La solicitud debe tener al menos un ítem' } }, { status: 400 });
    }

    await db.solicitudes.update({ where: { id: solicitudId }, data: { estado: 'enviada', fecha_envio: new Date() } });

    const requiereValidacion = await getTenantConfigBool(session.tenantId, 'requiere_validacion_responsable', true);

    if (!requiereValidacion) {
      // Skip responsable validation — notify directors directly
      await notificarPorRol(session.tenantId, 'director', 'Nueva solicitud para aprobar', `${session.nombre} solicita: ${solicitud.titulo}`, solicitudId);
    } else {
      const area = await prisma.areas.findFirst({ where: { id: solicitud.area_id, tenant_id: session.tenantId } });
      if (!area?.responsable_id) {
        await notificarPorRol(session.tenantId, 'director', 'Área sin responsable', `La solicitud "${solicitud.titulo}" fue enviada pero el área no tiene responsable asignado. Asigná uno para que pueda ser validada.`, solicitudId);
      } else {
        await crearNotificacion({
          tenantId: session.tenantId,
          destinatarioId: area.responsable_id,
          tipo: 'solicitud_enviada',
          titulo: 'Nueva solicitud para validar',
          mensaje: `${session.nombre} solicita: ${solicitud.titulo}`,
          solicitudId: solicitudId,
        });
      }
    }

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'enviar_solicitud', entidad: 'solicitud', entidadId: solicitudId });
    return Response.json({ message: 'Solicitud enviada' });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
