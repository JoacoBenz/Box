import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { verificarRol, verificarSegregacion } from '@/lib/permissions';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { crearNotificacion } from '@/lib/notifications';
import { rechazoSchema } from '@/lib/validators';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['director'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo directores pueden rechazar' } }, { status: 403 });
    }

    const { id } = await params;
    const solicitudId = parseInt(id);
    const db = tenantPrisma(session.tenantId);

    const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
    if (!solicitud) return Response.json({ error: { code: 'NOT_FOUND', message: 'No encontrada' } }, { status: 404 });
    if (solicitud.estado !== 'validada') {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Solo se pueden rechazar solicitudes validadas' } }, { status: 400 });
    }

    const seg = verificarSegregacion(solicitud, session.userId, 'aprobar');
    if (!seg.permitido) return Response.json({ error: { code: 'FORBIDDEN', message: seg.motivo } }, { status: 403 });

    const body = await request.json();
    const result = rechazoSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } }, { status: 400 });
    }

    await db.solicitudes.update({
      where: { id: solicitudId },
      data: { estado: 'rechazada', rechazado_por_id: session.userId, fecha_rechazo: new Date(), motivo_rechazo: result.data.motivo },
    });

    await crearNotificacion({ tenantId: session.tenantId, destinatarioId: solicitud.solicitante_id, tipo: 'solicitud_rechazada', titulo: 'Tu solicitud fue rechazada', mensaje: `${session.nombre} rechazó: ${solicitud.titulo}. Motivo: ${result.data.motivo}`, solicitudId });

    const area = await prisma.areas.findFirst({ where: { id: solicitud.area_id, tenant_id: session.tenantId } });
    if (area?.responsable_id && area.responsable_id !== solicitud.solicitante_id) {
      await crearNotificacion({ tenantId: session.tenantId, destinatarioId: area.responsable_id, tipo: 'solicitud_rechazada', titulo: 'Solicitud rechazada', mensaje: `"${solicitud.titulo}" fue rechazada. Motivo: ${result.data.motivo}`, solicitudId });
    }

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'rechazar_solicitud', entidad: 'solicitud', entidadId: solicitudId, datosNuevos: { motivo: result.data.motivo }, ipAddress: getClientIp(request) });
    return Response.json({ message: 'Solicitud rechazada' });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
