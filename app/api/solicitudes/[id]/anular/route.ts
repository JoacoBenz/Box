import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-handler';
import { verificarRol, apiError } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion } from '@/lib/notifications';

// States that can be cancelled
const ESTADOS_ANULABLES = ['enviada', 'validada', 'aprobada', 'en_compras', 'pago_programado'];

export const POST = withAuth({}, async (request, { session, db, ip }, params) => {
  const solicitudId = Number(params.id);
  if (isNaN(solicitudId)) return apiError('VALIDATION', 'ID inválido', 400);

  const body = await request.json().catch(() => ({}));
  const motivo = body.motivo?.trim();
  if (!motivo || motivo.length < 10) {
    return apiError('VALIDATION', 'Indicá el motivo de la anulación (mínimo 10 caracteres)', 400);
  }

  const solicitud = await db.solicitudes.findFirst({
    where: { id: solicitudId },
    include: { solicitante: { select: { id: true, nombre: true } } },
  });

  if (!solicitud) return apiError('NOT_FOUND', 'Solicitud no encontrada', 404);

  if (!ESTADOS_ANULABLES.includes(solicitud.estado)) {
    return apiError('INVALID_STATE', `No se puede anular una solicitud en estado "${solicitud.estado}". Solo se pueden anular solicitudes enviadas, validadas, aprobadas, en compras o con pago programado.`, 400);
  }

  // Permission: solicitante can cancel their own, or director/admin can cancel any
  const isOwner = solicitud.solicitante_id === session.userId;
  const isAuthorized = verificarRol(session.roles, ['director', 'admin']);

  if (!isOwner && !isAuthorized) {
    return apiError('FORBIDDEN', 'Solo el solicitante, un director o un admin pueden anular', 403);
  }

  // Optimistic locking
  const expectedUpdatedAt = body.updated_at;
  if (expectedUpdatedAt) {
    const current = solicitud.updated_at.toISOString();
    if (current !== expectedUpdatedAt) {
      return apiError('CONFLICT', 'Esta solicitud fue modificada por otro usuario. Recargá la página.', 409);
    }
  }

  const estadoAnterior = solicitud.estado;

  await db.solicitudes.update({
    where: { id: solicitudId },
    data: {
      estado: 'anulada',
      motivo_rechazo: `[ANULADA] ${motivo}`,
    },
  });

  // Notify solicitante if cancelled by someone else
  if (!isOwner) {
    await crearNotificacion({
      tenantId: session.tenantId,
      destinatarioId: solicitud.solicitante_id,
      tipo: 'solicitud_anulada',
      titulo: `Solicitud ${solicitud.numero} anulada`,
      mensaje: `Tu solicitud "${solicitud.titulo}" fue anulada por ${session.nombre}. Motivo: ${motivo}`,
      solicitudId,
    });
  }

  await registrarAuditoria({
    tenantId: session.tenantId,
    usuarioId: session.userId,
    accion: 'anular_solicitud',
    entidad: 'solicitudes',
    entidadId: solicitudId,
    datosAnteriores: { estado: estadoAnterior },
    datosNuevos: { estado: 'anulada', motivo },
    ipAddress: ip,
  });

  return NextResponse.json({ ok: true, estado: 'anulada' });
});
