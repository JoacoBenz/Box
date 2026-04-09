import { withAuth, parseId } from '@/lib/api-handler';
import { apiError } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion } from '@/lib/notifications';
import { sincronizarProductos } from '@/lib/productos';

export const POST = withAuth({ roles: ['tesoreria', 'admin'] }, async (request, { session, db, ip }, params) => {
  const solicitudId = parseId(params.id);
  if (!solicitudId) return apiError('BAD_REQUEST', 'ID inválido', 400);

  const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
  if (!solicitud) return apiError('NOT_FOUND', 'No encontrada', 404);
  if (!['recibida_con_obs', 'recibida'].includes(solicitud.estado)) {
    return apiError('BAD_REQUEST', 'Solo se pueden cerrar solicitudes recibidas', 400);
  }

  const body = await request.json().catch(() => ({}));
  const resolucion = body?.resolucion ?? 'Resuelto';

  // Optimistic locking: verify no concurrent modification
  const expectedUpdatedAt = body?.updated_at;
  if (expectedUpdatedAt) {
    const current = solicitud.updated_at.toISOString();
    if (current !== expectedUpdatedAt) {
      return apiError('CONFLICT', 'Esta solicitud fue modificada por otro usuario. Recargá la página.', 409);
    }
  }

  await db.solicitudes.update({ where: { id: solicitudId }, data: { estado: 'cerrada' } });

  // Auto-create/update productos from completed solicitud items
  await sincronizarProductos(session.tenantId, solicitudId).catch(() => {});

  await crearNotificacion({ tenantId: session.tenantId, destinatarioId: solicitud.solicitante_id, tipo: 'solicitud_cerrada', titulo: 'Tu solicitud fue cerrada', mensaje: `Resolución: ${resolucion}`, solicitudId });

  await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'cerrar_solicitud', entidad: 'solicitud', entidadId: solicitudId, datosNuevos: { resolucion }, ipAddress: ip });
  return Response.json({ message: 'Solicitud cerrada' });
});
