import { withAuth, validateBody } from '@/lib/api-handler';
import { apiError } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';
import { z } from 'zod';

const programarPagoSchema = z.object({
  dia_pago_programado: z.string().refine((val) => !isNaN(Date.parse(val)), 'Fecha inválida'),
});

export const POST = withAuth({ roles: ['compras'] }, async (request, { session, db, ip }, params) => {
  const solicitudId = parseInt(params.id);

  const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
  if (!solicitud) return apiError('NOT_FOUND', 'No encontrada', 404);
  if (solicitud.estado !== 'en_compras') {
    return apiError('BAD_REQUEST', 'Solo se pueden programar pagos de solicitudes en compras', 400);
  }

  const body = await request.json();
  const validation = validateBody(programarPagoSchema, body);
  if (!validation.success) return validation.response;

  // Optimistic locking: verify no concurrent modification
  const expectedUpdatedAt = body?.updated_at;
  if (expectedUpdatedAt) {
    const current = solicitud.updated_at.toISOString();
    if (current !== expectedUpdatedAt) {
      return apiError('CONFLICT', 'Esta solicitud fue modificada por otro usuario. Recargá la página.', 409);
    }
  }

  const diaPago = new Date(validation.data.dia_pago_programado);

  await db.solicitudes.update({
    where: { id: solicitudId },
    data: {
      estado: 'pago_programado',
      dia_pago_programado: diaPago,
    },
  });

  const fechaStr = diaPago.toLocaleDateString('es-AR');
  await crearNotificacion({
    tenantId: session.tenantId,
    destinatarioId: solicitud.solicitante_id,
    tipo: 'pago_programado',
    titulo: 'Pago programado',
    mensaje: `El pago de "${solicitud.titulo}" fue programado para el ${fechaStr}`,
    solicitudId,
  });
  await notificarPorRol(session.tenantId, 'tesoreria', 'Pago programado para ejecutar', `Pago de "${solicitud.titulo}" programado para el ${fechaStr}`, solicitudId);

  await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'programar_pago', entidad: 'solicitud', entidadId: solicitudId, datosNuevos: { dia_pago_programado: validation.data.dia_pago_programado }, ipAddress: ip });
  return Response.json({ message: 'Pago programado' });
});
