import { withAuth, parseId } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { verificarSegregacion, apiError } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';
import { getTenantConfigBool } from '@/lib/tenant-config';
import { canUserApproveAmount } from '@/lib/approval-limits';
import { verificarPresupuesto } from '@/lib/budget-control';

export const POST = withAuth({ roles: ['director'] }, async (request, { session, db, ip }, params) => {
  const solicitudId = parseId(params.id);
  if (!solicitudId) return apiError('BAD_REQUEST', 'ID inválido', 400);

  const solicitud = await db.solicitudes.findFirst({
    where: { id: solicitudId },
    include: { items_solicitud: true },
  });
  if (!solicitud) return apiError('NOT_FOUND', 'No encontrada', 404);

  // Compute total from items
  const montoTotal = solicitud.items_solicitud.reduce((acc, item) => {
    return acc + (item.precio_estimado ? Number(item.precio_estimado) * Number(item.cantidad) : 0);
  }, 0) || null;

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
    montoTotal
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

  const montoStr = montoTotal ? ` por $${montoTotal}` : '';

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
  if (solicitud.centro_costo_id && montoTotal) {
    const budget = await verificarPresupuesto(
      session.tenantId,
      solicitud.centro_costo_id,
      Number(montoTotal)
    );
    if (budget.status.excedido) {
      await notificarPorRol(
        session.tenantId,
        'tesoreria',
        `⚠ Presupuesto excedido: ${budget.status.centroCosto}`,
        `La solicitud ${solicitud.numero} ($${Number(montoTotal).toLocaleString()}) excede el presupuesto del centro de costo "${budget.status.centroCosto}". Uso: ${budget.status.alertaPorcentaje}%`,
        solicitudId
      );
    }
  }

  await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'aprobar_solicitud', entidad: 'solicitud', entidadId: solicitudId, ipAddress: ip });
  return Response.json({ message: 'Solicitud aprobada' });
});
