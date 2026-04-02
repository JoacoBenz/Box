import { withAuth, validateBody } from '@/lib/api-handler';
import { verificarSegregacion, apiError } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion } from '@/lib/notifications';
import { procesarComprasSchema } from '@/lib/validators';

export const POST = withAuth({ roles: ['compras'] }, async (request, { session, db, ip }, params) => {
  const solicitudId = parseInt(params.id);

  const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
  if (!solicitud) return apiError('NOT_FOUND', 'No encontrada', 404);
  if (!['aprobada', 'en_compras'].includes(solicitud.estado)) {
    return apiError('BAD_REQUEST', 'Solo se pueden procesar solicitudes aprobadas', 400);
  }

  const seg = verificarSegregacion(solicitud, session.userId, 'procesar_compras');
  if (!seg.permitido) return apiError('FORBIDDEN', seg.motivo, 403);

  const body = await request.json();
  const validation = validateBody(procesarComprasSchema, body);
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
    data: {
      estado: 'en_compras',
      procesado_por_id: session.userId,
      fecha_procesamiento: new Date(),
      prioridad_compra: validation.data.prioridad_compra,
      observaciones_compras: validation.data.observaciones ?? null,
    },
  });

  await crearNotificacion({
    tenantId: session.tenantId,
    destinatarioId: solicitud.solicitante_id,
    tipo: 'solicitud_en_compras',
    titulo: 'Tu solicitud está siendo procesada',
    mensaje: `El sector Compras está procesando: ${solicitud.titulo}`,
    solicitudId,
  });

  await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'procesar_compras', entidad: 'solicitud', entidadId: solicitudId, datosNuevos: { prioridad_compra: validation.data.prioridad_compra, observaciones: validation.data.observaciones }, ipAddress: ip });
  return Response.json({ message: 'Solicitud en procesamiento' });
});
