import { withAuth } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { verificarSegregacion, apiError } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';
import { getTenantConfigBool } from '@/lib/tenant-config';
import { canUserApproveAmount } from '@/lib/approval-limits';
import { verificarPresupuesto } from '@/lib/budget-control';

export const POST = withAuth({ roles: ['director'] }, async (request, { session, db, ip }) => {
  const body = await request.json().catch(() => null);
  if (!body?.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    return apiError('BAD_REQUEST', 'Se requiere un array de IDs', 400);
  }

  const ids: number[] = body.ids.filter((id: any) => typeof id === 'number' && id > 0);
  if (ids.length === 0) {
    return apiError('BAD_REQUEST', 'No se proporcionaron IDs válidos', 400);
  }
  if (ids.length > 50) {
    return apiError('BAD_REQUEST', 'Máximo 50 solicitudes por lote', 400);
  }

  const skipValidacion = !(await getTenantConfigBool(session.tenantId, 'requiere_validacion_responsable', true));
  const estadosPermitidos = skipValidacion ? ['validada', 'enviada'] : ['validada'];

  // Check if tenant has compras users
  const comprasRole = await prisma.roles.findUnique({ where: { nombre: 'compras' } });
  const hasComprasUsers = comprasRole ? await prisma.usuarios_roles.count({
    where: { rol_id: comprasRole.id, usuario: { tenant_id: session.tenantId, activo: true } },
  }) > 0 : false;
  const nuevoEstado = hasComprasUsers ? 'en_compras' : 'aprobada';

  const aprobadas: number[] = [];
  const errores: { id: number; error: string }[] = [];

  for (const solicitudId of ids) {
    try {
      const solicitud = await db.solicitudes.findFirst({
        where: { id: solicitudId },
        include: { items_solicitud: true },
      });

      if (!solicitud) {
        errores.push({ id: solicitudId, error: 'No encontrada' });
        continue;
      }

      if (!estadosPermitidos.includes(solicitud.estado)) {
        errores.push({ id: solicitudId, error: 'No está pendiente de aprobación' });
        continue;
      }

      const seg = verificarSegregacion(solicitud, session.userId, 'aprobar');
      if (!seg.permitido) {
        errores.push({ id: solicitudId, error: seg.motivo });
        continue;
      }

      const montoTotal = solicitud.items_solicitud.reduce((acc, item) => {
        return acc + (item.precio_estimado ? Number(item.precio_estimado) * Number(item.cantidad) : 0);
      }, 0) || null;

      const amountCheck = await canUserApproveAmount(session.tenantId, session.roles, montoTotal);
      if (!amountCheck.allowed) {
        errores.push({ id: solicitudId, error: amountCheck.reason! });
        continue;
      }

      // Approve
      await db.solicitudes.update({
        where: { id: solicitudId },
        data: { estado: nuevoEstado, aprobado_por_id: session.userId, fecha_aprobacion: new Date() },
      });

      // Notifications
      const montoStr = montoTotal ? ` por $${montoTotal.toLocaleString()}` : '';
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

      // Budget warning
      if (solicitud.centro_costo_id && montoTotal) {
        const budget = await verificarPresupuesto(session.tenantId, solicitud.centro_costo_id, Number(montoTotal));
        if (budget.status.excedido) {
          await notificarPorRol(session.tenantId, 'tesoreria', `⚠ Presupuesto excedido: ${budget.status.centroCosto}`, `La solicitud ${solicitud.numero} ($${Number(montoTotal).toLocaleString()}) excede el presupuesto del centro de costo "${budget.status.centroCosto}". Uso: ${budget.status.alertaPorcentaje}%`, solicitudId);
        }
      }

      await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'aprobar_solicitud', entidad: 'solicitud', entidadId: solicitudId, ipAddress: ip });
      aprobadas.push(solicitudId);
    } catch (e: any) {
      errores.push({ id: solicitudId, error: e.message?.slice(0, 100) || 'Error desconocido' });
    }
  }

  return Response.json({ aprobadas: aprobadas.length, errores });
});
