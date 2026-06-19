import { withAuth, parseId } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { verificarSegregacion, apiError } from '@/lib/permissions';
import { checkOptimisticLock } from '@/lib/optimistic-lock';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol, notificarResponsableArea } from '@/lib/notifications';
import { getTenantConfigBool } from '@/lib/tenant-config';
import { canUserApproveAmount } from '@/lib/approval-limits';
import { verificarPresupuesto, verificarPresupuestoArea } from '@/lib/budget-control';

export const POST = withAuth(
  { roles: ['director'] },
  async (request, { session, db, ip }, params) => {
    const solicitudId = parseId(params.id);
    if (!solicitudId) return apiError('BAD_REQUEST', 'ID inválido', 400);

    const solicitud = await db.solicitudes.findFirst({
      where: { id: solicitudId },
      include: { items_solicitud: true },
    });
    if (!solicitud) return apiError('NOT_FOUND', 'No encontrada', 404);

    // Compute total from items
    const montoTotal =
      solicitud.items_solicitud.reduce((acc, item) => {
        return (
          acc + (item.precio_estimado ? Number(item.precio_estimado) * Number(item.cantidad) : 0)
        );
      }, 0) || null;

    const skipValidacion = !(await getTenantConfigBool(
      session.tenantId,
      'requiere_validacion_responsable',
      true,
    ));
    const estadosPermitidos = skipValidacion ? ['validada', 'enviada'] : ['validada'];
    if (!estadosPermitidos.includes(solicitud.estado)) {
      return apiError('BAD_REQUEST', 'Esta solicitud no está pendiente de aprobación', 400);
    }

    const seg = verificarSegregacion(solicitud, session.userId, 'aprobar');
    if (!seg.permitido) return apiError('FORBIDDEN', seg.motivo, 403);

    // Check approval limits based on amount
    const amountCheck = await canUserApproveAmount(session.tenantId, session.roles, montoTotal);
    if (!amountCheck.allowed) {
      return apiError('INSUFFICIENT_AUTHORITY', amountCheck.reason!, 403);
    }

    const body = await request.json().catch(() => ({}));
    const lockError = checkOptimisticLock(body?.updated_at, solicitud.updated_at);
    if (lockError) return lockError;

    // Check if tenant has users with 'compras' role to route there
    const comprasRole = await prisma.roles.findUnique({ where: { nombre: 'compras' } });
    const hasComprasUsers = comprasRole
      ? (await prisma.usuarios_roles.count({
          where: { rol_id: comprasRole.id, usuario: { tenant_id: session.tenantId, activo: true } },
        })) > 0
      : false;

    const nuevoEstado = hasComprasUsers ? 'en_compras' : 'aprobada';

    await db.solicitudes.update({
      where: { id: solicitudId },
      data: { estado: nuevoEstado, aprobado_por_id: session.userId, fecha_aprobacion: new Date() },
    });

    const montoStr = montoTotal ? ` por $${montoTotal}` : '';

    if (hasComprasUsers) {
      await crearNotificacion({
        tenantId: session.tenantId,
        destinatarioId: solicitud.solicitante_id,
        tipo: 'solicitud_aprobada',
        titulo: 'Tu solicitud fue aprobada',
        mensaje: `${session.nombre} aprobó: ${solicitud.titulo}. El sector Compras la procesará.`,
        solicitudId,
      });
      await notificarPorRol(
        session.tenantId,
        'compras',
        'Nueva solicitud para procesar',
        `Solicitud aprobada: ${solicitud.titulo}${montoStr}`,
        solicitudId,
      );
    } else {
      await crearNotificacion({
        tenantId: session.tenantId,
        destinatarioId: solicitud.solicitante_id,
        tipo: 'solicitud_aprobada',
        titulo: 'Tu solicitud fue aprobada',
        mensaje: `${session.nombre} aprobó: ${solicitud.titulo}. Tesorería la procesará en breve.`,
        solicitudId,
      });
      await notificarPorRol(
        session.tenantId,
        'tesoreria',
        'Nueva compra para ejecutar',
        `Solicitud aprobada: ${solicitud.titulo}${montoStr}`,
        solicitudId,
      );
    }

    if (solicitud.validado_por_id) {
      await notificarResponsableArea({
        tenantId: session.tenantId,
        areaId: solicitud.area_id,
        tipo: 'solicitud_aprobada',
        titulo: 'Solicitud aprobada',
        mensaje: `La solicitud "${solicitud.titulo}" fue aprobada`,
        solicitudId,
      });
    }

    // Budget control warning
    if (solicitud.centro_costo_id && montoTotal) {
      const budget = await verificarPresupuesto(
        session.tenantId,
        solicitud.centro_costo_id,
        Number(montoTotal),
      );
      if (budget.status.excedido) {
        await notificarPorRol(
          session.tenantId,
          'tesoreria',
          `⚠ Presupuesto excedido: ${budget.status.centroCosto}`,
          `La solicitud ${solicitud.numero} ($${Number(montoTotal).toLocaleString()}) excede el presupuesto del centro de costo "${budget.status.centroCosto}". Uso: ${budget.status.alertaPorcentaje}%`,
          solicitudId,
        );
      }
    }

    await registrarAuditoria({
      tenantId: session.tenantId,
      usuarioId: session.userId,
      accion: 'aprobar_solicitud',
      entidad: 'solicitud',
      entidadId: solicitudId,
      ipAddress: ip,
    });

    let presupuestoAlerta: { porcentaje: number; mensaje: string } | null = null;
    if (montoTotal) {
      const areaBudget = await verificarPresupuestoArea(
        session.tenantId,
        solicitud.area_id,
        Number(montoTotal),
      );
      if (
        areaBudget.status.presupuestoMensual !== null ||
        areaBudget.status.presupuestoAnual !== null
      ) {
        const pctMensual = areaBudget.status.presupuestoMensual
          ? Math.round(
              ((areaBudget.status.gastoMensual + Number(montoTotal)) /
                areaBudget.status.presupuestoMensual) *
                100,
            )
          : 0;
        const pctAnual = areaBudget.status.presupuestoAnual
          ? Math.round(
              ((areaBudget.status.gastoAnual + Number(montoTotal)) /
                areaBudget.status.presupuestoAnual) *
                100,
            )
          : 0;
        const pct = Math.max(pctMensual, pctAnual);
        if (pct >= 70) {
          presupuestoAlerta = {
            porcentaje: pct,
            mensaje:
              pct >= 100
                ? `Al aprobar, el presupuesto del área quedará excedido (${pct}%)`
                : `Al aprobar, el presupuesto del área quedará al ${pct}%`,
          };
        }
      }
    }

    return Response.json({ message: 'Solicitud aprobada', presupuestoAlerta });
  },
);
