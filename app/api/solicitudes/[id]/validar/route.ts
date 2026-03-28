import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma } from '@/lib/prisma';
import { verificarRol, verificarSegregacion, verificarResponsableDeArea } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['responsable_area'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo responsables de área pueden validar' } }, { status: 403 });
    }

    const { id } = await params;
    const solicitudId = parseInt(id);
    const db = tenantPrisma(session.tenantId);

    const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
    if (!solicitud) return Response.json({ error: { code: 'NOT_FOUND', message: 'No encontrada' } }, { status: 404 });
    if (!['enviada', 'devuelta_dir'].includes(solicitud.estado)) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Esta solicitud no está pendiente de validación' } }, { status: 400 });
    }

    const seg = verificarSegregacion(solicitud, session.userId, 'validar');
    if (!seg.permitido) return Response.json({ error: { code: 'FORBIDDEN', message: seg.motivo } }, { status: 403 });

    const esResponsable = await verificarResponsableDeArea(session.tenantId, session.userId, solicitud.area_id);
    if (!esResponsable) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'No sos responsable del área de esta solicitud' } }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const observaciones = body?.observaciones ?? null;

    await db.solicitudes.update({
      where: { id: solicitudId },
      data: { estado: 'validada', validado_por_id: session.userId, fecha_validacion: new Date(), observaciones_responsable: observaciones },
    });

    await notificarPorRol(session.tenantId, 'director', 'Solicitud lista para aprobar', `${session.nombre} validó: ${solicitud.titulo}`, solicitudId);
    await crearNotificacion({ tenantId: session.tenantId, destinatarioId: solicitud.solicitante_id, tipo: 'solicitud_validada', titulo: 'Tu solicitud fue validada', mensaje: `Tu solicitud "${solicitud.titulo}" pasó a aprobación de Dirección`, solicitudId });

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'validar_solicitud', entidad: 'solicitud', entidadId: solicitudId });
    return Response.json({ message: 'Solicitud validada' });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
