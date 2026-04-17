import { withTenant, parseId } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { apiError, verificarResponsableDeArea } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';
import { getTenantConfigBool } from '@/lib/tenant-config';

export const POST = withTenant(async (request, { session, db, ip }, params) => {
  const solicitudId = parseId(params.id);
  if (!solicitudId) return apiError('BAD_REQUEST', 'ID inválido', 400);

  const solicitud = await db.solicitudes.findFirst({
    where: { id: solicitudId },
    include: { items_solicitud: true },
  });
  if (!solicitud) return apiError('NOT_FOUND', 'No encontrada', 404);
  if (!['borrador', 'devuelta_resp', 'devuelta_dir'].includes(solicitud.estado)) {
    return apiError(
      'BAD_REQUEST',
      'Solo se pueden enviar solicitudes en borrador o devueltas',
      400,
    );
  }
  if (solicitud.solicitante_id !== session.userId) {
    return apiError('FORBIDDEN', 'Solo el solicitante puede enviar', 403);
  }
  if (solicitud.items_solicitud.length === 0) {
    return apiError('BAD_REQUEST', 'La solicitud debe tener al menos un ítem', 400);
  }

  // Optimistic locking: verify no concurrent modification
  const body = await request.json().catch(() => ({}));
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

  // Check if the solicitante is the responsable of the solicitud's area
  const esResponsableDelArea =
    session.roles.includes('responsable_area') &&
    (await verificarResponsableDeArea(session.tenantId, session.userId, solicitud.area_id));

  const requiereValidacion = await getTenantConfigBool(
    session.tenantId,
    'requiere_validacion_responsable',
    true,
  );
  const skipValidacion = !requiereValidacion || esResponsableDelArea;

  if (skipValidacion) {
    // Go directly to pendiente_dir (auto-validated or config skip)
    await db.solicitudes.update({
      where: { id: solicitudId },
      data: {
        estado: 'validada',
        fecha_envio: new Date(),
        validado_por_id: esResponsableDelArea ? session.userId : null,
        fecha_validacion: esResponsableDelArea ? new Date() : null,
      },
    });

    // Register auto-validation in audit for timeline
    if (esResponsableDelArea) {
      await registrarAuditoria({
        tenantId: session.tenantId,
        usuarioId: session.userId,
        accion: 'validar_solicitud',
        entidad: 'solicitud',
        entidadId: solicitudId,
        datosNuevos: { automatico: true },
        ipAddress: ip,
      });
    }

    await notificarPorRol(
      session.tenantId,
      'director',
      'Nueva solicitud para aprobar',
      `${session.nombre} solicita: ${solicitud.titulo}`,
      solicitudId,
    );
  } else {
    await db.solicitudes.update({
      where: { id: solicitudId },
      data: { estado: 'enviada', fecha_envio: new Date() },
    });

    const area = await prisma.areas.findFirst({
      where: { id: solicitud.area_id, tenant_id: session.tenantId },
    });
    if (!area?.responsable_id) {
      await notificarPorRol(
        session.tenantId,
        'director',
        'Área sin responsable',
        `La solicitud "${solicitud.titulo}" fue enviada pero el área no tiene responsable asignado. Asigná uno para que pueda ser validada.`,
        solicitudId,
      );
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

  await registrarAuditoria({
    tenantId: session.tenantId,
    usuarioId: session.userId,
    accion: 'enviar_solicitud',
    entidad: 'solicitud',
    entidadId: solicitudId,
    ipAddress: ip,
  });
  return Response.json({ message: 'Solicitud enviada', autoValidada: esResponsableDelArea });
});
