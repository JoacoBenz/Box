import { withAuth, validateBody, parseId } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import {
  verificarRol,
  verificarSegregacion,
  verificarResponsableDeArea,
  apiError,
} from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion } from '@/lib/notifications';
import { devolucionSchema } from '@/lib/validators';

export const POST = withAuth({}, async (request, { session, db, ip }, params) => {
  const solicitudId = parseId(params.id);
  if (!solicitudId) return apiError('BAD_REQUEST', 'ID inválido', 400);

  const body = await request.json();
  const validation = validateBody(devolucionSchema, body);
  if (!validation.success) return validation.response;

  const origen = validation.data.origen;

  const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
  if (!solicitud) return apiError('NOT_FOUND', 'No encontrada', 404);

  // Optimistic locking: verify no concurrent modification
  const expectedUpdatedAt = body?.updated_at;
  if (expectedUpdatedAt) {
    const current = solicitud.updated_at.toISOString();
    if (current !== expectedUpdatedAt) {
      return apiError(
        'CONFLICT',
        'Esta solicitud fue modificada por otro usuario. Recargá la página.',
        409,
      );
    }
  }

  if (origen === 'responsable') {
    if (!verificarRol(session.roles, ['responsable_area'])) {
      return apiError('FORBIDDEN', 'Sin permiso', 403);
    }
    if (solicitud.estado !== 'enviada') {
      return apiError('BAD_REQUEST', 'Solo se pueden devolver solicitudes enviadas', 400);
    }
    const seg = verificarSegregacion(solicitud, session.userId, 'validar');
    if (!seg.permitido) return apiError('FORBIDDEN', seg.motivo, 403);
    const esResponsable = await verificarResponsableDeArea(
      session.tenantId,
      session.userId,
      solicitud.area_id,
    );
    if (!esResponsable) return apiError('FORBIDDEN', 'No sos responsable del área', 403);

    await db.solicitudes.update({
      where: { id: solicitudId },
      data: { estado: 'devuelta_resp', observaciones_responsable: validation.data.observaciones },
    });
    await crearNotificacion({
      tenantId: session.tenantId,
      destinatarioId: solicitud.solicitante_id,
      tipo: 'solicitud_devuelta',
      titulo: 'Solicitud devuelta para corrección',
      mensaje: `${session.nombre}: ${validation.data.observaciones}`,
      solicitudId,
    });
  } else if (origen === 'director') {
    if (!verificarRol(session.roles, ['director'])) {
      return apiError('FORBIDDEN', 'Sin permiso', 403);
    }
    if (solicitud.estado !== 'validada') {
      return apiError('BAD_REQUEST', 'Solo se pueden devolver solicitudes validadas', 400);
    }
    const seg = verificarSegregacion(solicitud, session.userId, 'aprobar');
    if (!seg.permitido) return apiError('FORBIDDEN', seg.motivo, 403);

    await db.solicitudes.update({
      where: { id: solicitudId },
      data: { estado: 'devuelta_dir', observaciones_director: validation.data.observaciones },
    });

    const area = await prisma.areas.findFirst({
      where: { id: solicitud.area_id, tenant_id: session.tenantId },
    });
    if (area?.responsable_id) {
      await crearNotificacion({
        tenantId: session.tenantId,
        destinatarioId: area.responsable_id,
        tipo: 'solicitud_devuelta_dir',
        titulo: 'Solicitud devuelta por Dirección',
        mensaje: `${session.nombre}: ${validation.data.observaciones}`,
        solicitudId,
      });
    }
    await crearNotificacion({
      tenantId: session.tenantId,
      destinatarioId: solicitud.solicitante_id,
      tipo: 'solicitud_devuelta_dir',
      titulo: 'Solicitud devuelta por Dirección',
      mensaje: `${session.nombre}: ${validation.data.observaciones}`,
      solicitudId,
    });
  } else {
    return apiError('BAD_REQUEST', 'origen debe ser responsable o director', 400);
  }

  await registrarAuditoria({
    tenantId: session.tenantId,
    usuarioId: session.userId,
    accion: `devolver_${origen}`,
    entidad: 'solicitud',
    entidadId: solicitudId,
    datosNuevos: { observaciones: validation.data.observaciones },
    ipAddress: ip,
  });
  return Response.json({ message: 'Solicitud devuelta' });
});
