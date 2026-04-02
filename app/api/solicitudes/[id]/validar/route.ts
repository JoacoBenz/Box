import { withAuth } from '@/lib/api-handler';
import { verificarSegregacion, verificarResponsableDeArea, apiError } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';

export const POST = withAuth({ roles: ['responsable_area'] }, async (request, { session, db, ip }, params) => {
  const solicitudId = parseInt(params.id);

  const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
  if (!solicitud) return apiError('NOT_FOUND', 'No encontrada', 404);
  if (!['enviada', 'devuelta_dir'].includes(solicitud.estado)) {
    return apiError('BAD_REQUEST', 'Esta solicitud no está pendiente de validación', 400);
  }

  const seg = verificarSegregacion(solicitud, session.userId, 'validar');
  if (!seg.permitido) return apiError('FORBIDDEN', seg.motivo, 403);

  const esResponsable = await verificarResponsableDeArea(session.tenantId, session.userId, solicitud.area_id);
  if (!esResponsable) {
    return apiError('FORBIDDEN', 'No sos responsable del área de esta solicitud', 403);
  }

  const body = await request.json().catch(() => ({}));
  const observaciones = body?.observaciones ?? null;

  // Optimistic locking: verify no concurrent modification
  const expectedUpdatedAt = body?.updated_at;
  if (expectedUpdatedAt) {
    const current = solicitud.updated_at.toISOString();
    if (current !== expectedUpdatedAt) {
      return apiError('CONFLICT', 'Esta solicitud fue modificada por otro usuario. Recargá la página.', 409);
    }
  }

  await db.solicitudes.update({
    where: { id: solicitudId },
    data: { estado: 'validada', validado_por_id: session.userId, fecha_validacion: new Date(), observaciones_responsable: observaciones },
  });

  await notificarPorRol(session.tenantId, 'director', 'Solicitud lista para aprobar', `${session.nombre} validó: ${solicitud.titulo}`, solicitudId);
  await crearNotificacion({ tenantId: session.tenantId, destinatarioId: solicitud.solicitante_id, tipo: 'solicitud_validada', titulo: 'Tu solicitud fue validada', mensaje: `Tu solicitud "${solicitud.titulo}" pasó a aprobación de Dirección`, solicitudId });

  await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'validar_solicitud', entidad: 'solicitud', entidadId: solicitudId, ipAddress: ip });
  return Response.json({ message: 'Solicitud validada' });
});
