import { withAuth, validateBody } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { verificarSegregacion, apiError } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion } from '@/lib/notifications';
import { rechazoSchema } from '@/lib/validators';
import { getTenantConfigBool } from '@/lib/tenant-config';

export const POST = withAuth({ roles: ['director'] }, async (request, { session, db, ip }, params) => {
  const solicitudId = parseInt(params.id);

  const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
  if (!solicitud) return apiError('NOT_FOUND', 'No encontrada', 404);

  const skipValidacion = !(await getTenantConfigBool(session.tenantId, 'requiere_validacion_responsable', true));
  const estadosPermitidos = skipValidacion ? ['validada', 'enviada'] : ['validada'];
  if (!estadosPermitidos.includes(solicitud.estado)) {
    return apiError('BAD_REQUEST', 'Esta solicitud no está pendiente de revisión', 400);
  }

  const seg = verificarSegregacion(solicitud, session.userId, 'aprobar');
  if (!seg.permitido) return apiError('FORBIDDEN', seg.motivo, 403);

  const body = await request.json();
  const validation = validateBody(rechazoSchema, body);
  if (!validation.success) return validation.response;

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
    data: { estado: 'rechazada', rechazado_por_id: session.userId, fecha_rechazo: new Date(), motivo_rechazo: validation.data.motivo },
  });

  await crearNotificacion({ tenantId: session.tenantId, destinatarioId: solicitud.solicitante_id, tipo: 'solicitud_rechazada', titulo: 'Tu solicitud fue rechazada', mensaje: `${session.nombre} rechazó: ${solicitud.titulo}. Motivo: ${validation.data.motivo}`, solicitudId });

  const area = await prisma.areas.findFirst({ where: { id: solicitud.area_id, tenant_id: session.tenantId } });
  if (area?.responsable_id && area.responsable_id !== solicitud.solicitante_id) {
    await crearNotificacion({ tenantId: session.tenantId, destinatarioId: area.responsable_id, tipo: 'solicitud_rechazada', titulo: 'Solicitud rechazada', mensaje: `"${solicitud.titulo}" fue rechazada. Motivo: ${validation.data.motivo}`, solicitudId });
  }

  await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'rechazar_solicitud', entidad: 'solicitud', entidadId: solicitudId, datosNuevos: { motivo: validation.data.motivo }, ipAddress: ip });
  return Response.json({ message: 'Solicitud rechazada' });
});
