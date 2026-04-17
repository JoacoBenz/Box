import { withAuth, validateBody, parseId } from '@/lib/api-handler';
import { verificarSegregacion, apiError } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';
import { procesarComprasSchema } from '@/lib/validators';

export const POST = withAuth(
  { roles: ['compras'] },
  async (request, { session, db, ip }, params) => {
    const solicitudId = parseId(params.id);
    if (!solicitudId) return apiError('BAD_REQUEST', 'ID inválido', 400);

    const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
    if (!solicitud) return apiError('NOT_FOUND', 'No encontrada', 404);
    if (solicitud.estado !== 'en_compras') {
      return apiError('BAD_REQUEST', 'Solo se pueden procesar solicitudes en compras', 400);
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
        return apiError(
          'CONFLICT',
          'Esta solicitud fue modificada por otro usuario. Recargá la página.',
          409,
        );
      }
    }

    // Validate dia_pago_programado is required and not in the past
    const diaPagoStr = validation.data.dia_pago_programado;
    if (!diaPagoStr) {
      return apiError('BAD_REQUEST', 'La fecha de pago es obligatoria', 400);
    }
    const diaPago = new Date(diaPagoStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (diaPago < today) {
      return apiError('BAD_REQUEST', 'La fecha de pago no puede ser en el pasado', 400);
    }

    await db.solicitudes.update({
      where: { id: solicitudId },
      data: {
        estado: 'pago_programado',
        procesado_por_id: session.userId,
        fecha_procesamiento: new Date(),
        prioridad_compra: validation.data.prioridad_compra,
        observaciones_compras: validation.data.observaciones ?? null,
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
    await notificarPorRol(
      session.tenantId,
      'tesoreria',
      'Pago programado para ejecutar',
      `Pago de "${solicitud.titulo}" programado para el ${fechaStr}`,
      solicitudId,
    );

    await registrarAuditoria({
      tenantId: session.tenantId,
      usuarioId: session.userId,
      accion: 'programar_pago',
      entidad: 'solicitud',
      entidadId: solicitudId,
      datosNuevos: {
        prioridad_compra: validation.data.prioridad_compra,
        observaciones: validation.data.observaciones,
        dia_pago_programado: diaPagoStr,
      },
      ipAddress: ip,
    });
    return Response.json({ message: 'Pago programado' });
  },
);
