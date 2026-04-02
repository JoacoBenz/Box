import { withAuth } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { verificarSegregacion, apiError } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';
import { getTenantConfigBool } from '@/lib/tenant-config';
import { canUserApproveAmount } from '@/lib/approval-limits';
import { verificarPresupuesto } from '@/lib/budget-control';

export const POST = withAuth({ roles: ['director'] }, async (request, { session, db, ip }, params) => {
  const solicitudId = parseInt(params.id);

  const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
  if (!solicitud) return apiError('NOT_FOUND', 'No encontrada', 404);

  const skipValidacion = !(await getTenantConfigBool(session.tenantId, 'requiere_validacion_responsable', true));
  const estadosPermitidos = skipValidacion ? ['validada', 'enviada'] : ['validada'];
  if (!estadosPermitidos.includes(solicitud.estado)) {
    return apiError('BAD_REQUEST', 'Esta solicitud no está pendiente de aprobación', 400);
  }

  const seg = verificarSegregacion(solicitud, session.userId, 'aprobar');
  if (!seg.permitido) return apiError('FORBIDDEN', seg.motivo, 403);

  // Check approval limits based on amount
  const amountCheck = await canUserApproveAmount(
    session.tenantId,
    session.roles,
    solicitud.monto_estimado_total ? Number(solicitud.monto_estimado_total) : null
  );
  if (!amountCheck.allowed) {
    return apiError('INSUFFICIENT_AUTHORITY', amountCheck.reason!, 403);
  }

  // Optimistic locking: verify no concurrent modification
  const body = await request.json().catch(() => ({}));
  const expectedUpdatedAt = body?.updated_at;
  if (expectedUpdatedAt) {
    const current = solicitud.updated_at.toISOString();
    if (current !== expectedUpdatedAt) {
      return apiError('CONFLICT', 'Esta solicitud fue modificada por otro usuario. Recargá la página.', 409);
    }
  }

  // Check if tenant has users with 'compras' role to route there
  const comprasRole = await prisma.roles.findUnique({ where: { nombre: 'compras' } });
  const hasComprasUsers = comprasRole ? await prisma.usuarios_roles.count({
    where: { rol_id: comprasRole.id, usuario: { tenant_id: session.tenantId, activo: true } },
  }) > 0 : false;

  const nuevoEstado = hasComprasUsers ? 'en_compras' : 'aprobada';

  await db.solicitudes.update({
    where: { id: solicitudId },
    data: { estado: nuevoEstado, aprobado_por_id: session.userId, fecha_aprobacion: new Date() },
  });

  const montoStr = solicitud.monto_estimado_total ? ` por $${solicitud.monto_estimado_total}` : '';

  if (hasComprasUsers) {
    await crearNotificacion({ tenantId: session.tenantId, destinatarioId: solicitud.solicitante_id, tipo: 'solicitud_aprobada', titulo: 'Tu solicitud fue aprobada', mensaje: `${session.nombre} aprobó: ${solicitud.titulo}. El sector Compras la procesará.`, solicitudId });
    await notificarPorRol(session.tenantId, 'compras', 'Nueva solicitud para procesar', `Solicitud aprobada: ${solicitud.titulo}${montoStr}`, solicitudId);
  } else {
    await crearNotificacion({ tenantId: session.tenantId, destinatarioId: solicitud.solicitante_id, tipo: 'solicitud_aprobada', titulo: 'Tu solicitud fue aprobada', mensaje: `${session.nombre} aprobó: ${solicitud.titulo}. Tesorería la procesará en breve.`, solicitudId });
    await notificarPorRol(session.tenantId, 'tesoreria', 'Nueva compra para ejecutar', `Solicitud aprobada: ${solicitud.titulo}${montoStr}`, solicitudId);
  }

  if (solicitud.validado_por_id) {
    const area = await prisma.areas.findFirst({ where: { id: solicitud.area_id, tenant_id: session.tenantId } });
    if (area?.responsable_id) {
      await crearNotificacion({ tenantId: session.tenantId, destinatarioId: area.responsable_id, tipo: 'solicitud_aprobada', titulo: 'Solicitud aprobada', mensaje: `La solicitud "${solicitud.titulo}" fue aprobada`, solicitudId });
    }
  }

  // Budget control warning
  if (solicitud.centro_costo_id && solicitud.monto_estimado_total) {
    const budget = await verificarPresupuesto(
      session.tenantId,
      solicitud.centro_costo_id,
      Number(solicitud.monto_estimado_total)
    );
    if (budget.status.excedido) {
      await notificarPorRol(
        session.tenantId,
        'tesoreria',
        `⚠ Presupuesto excedido: ${budget.status.centroCosto}`,
        `La solicitud ${solicitud.numero} ($${Number(solicitud.monto_estimado_total).toLocaleString()}) excede el presupuesto del centro de costo "${budget.status.centroCosto}". Uso: ${budget.status.alertaPorcentaje}%`,
        solicitudId
      );
    }
  }

  await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'aprobar_solicitud', entidad: 'solicitud', entidadId: solicitudId, ipAddress: ip });
  return Response.json({ message: 'Solicitud aprobada' });
});
