import { withAdminOverride, withAuth, validateBody, parseId } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { solicitudSchema } from '@/lib/validators';
import { registrarAuditoria } from '@/lib/audit';

export const GET = withAdminOverride({}, async (request, { session, db, effectiveTenantId }, params) => {
  const solicitudId = parseId(params.id);
  if (!solicitudId) return Response.json({ error: { code: 'BAD_REQUEST', message: 'ID inválido' } }, { status: 400 });

  const solicitud = await db.solicitudes.findFirst({
    where: { id: solicitudId },
    include: {
      solicitante: { select: { id: true, nombre: true, email: true } },
      area: { select: { id: true, nombre: true } },
      centro_costo: { select: { id: true, nombre: true, codigo: true } },
      validado_por: { select: { id: true, nombre: true } },
      aprobado_por: { select: { id: true, nombre: true } },
      rechazado_por: { select: { id: true, nombre: true } },
      proveedor: { select: { id: true, nombre: true, cuit: true, telefono: true, email: true, link_pagina: true } },
      items_solicitud: true,
      compras: { include: { ejecutado_por: { select: { id: true, nombre: true } } } },
      recepciones: { include: { receptor: { select: { id: true, nombre: true } } } },
    },
  });

  if (!solicitud) return Response.json({ error: { code: 'NOT_FOUND', message: 'Solicitud no encontrada' } }, { status: 404 });

  const { userId, roles, areaId } = session;
  const esSolicitante = solicitud.solicitante_id === userId;
  const esResponsableArea = solicitud.area_id === areaId;
  const tieneAcceso = esSolicitante || esResponsableArea || roles.includes('director') || roles.includes('tesoreria') || roles.includes('compras') || roles.includes('admin') || roles.includes('super_admin');
  if (!tieneAcceso) return Response.json({ error: { code: 'FORBIDDEN', message: 'Sin acceso a esta solicitud' } }, { status: 403 });

  // Add archivos
  const archivos = await prisma.archivos.findMany({
    where: { ...(effectiveTenantId ? { tenant_id: effectiveTenantId } : {}), entidad: 'solicitud', entidad_id: solicitudId },
  });

  return Response.json({ ...solicitud, archivos });
});

export const PATCH = withAuth({}, async (request, { session, db, ip }, params) => {
  const solicitudId = parseId(params.id);
  if (!solicitudId) return Response.json({ error: { code: 'BAD_REQUEST', message: 'ID inválido' } }, { status: 400 });

  const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
  if (!solicitud) return Response.json({ error: { code: 'NOT_FOUND', message: 'No encontrada' } }, { status: 404 });
  if (!['borrador', 'devuelta_resp', 'devuelta_dir'].includes(solicitud.estado)) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: 'Solo se pueden editar solicitudes en borrador o devueltas' } }, { status: 400 });
  }
  if (solicitud.solicitante_id !== session.userId) {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo el solicitante puede editar' } }, { status: 403 });
  }

  const body = await request.json();
  const parsed = validateBody(solicitudSchema.partial(), body);
  if (!parsed.success) return parsed.response;

  // Validate items array individually if provided
  if (parsed.data.items !== undefined && parsed.data.items.length === 0) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: [{ field: 'items', message: 'Agregá al menos un ítem' }] } }, { status: 400 });
  }

  const { titulo, descripcion, justificacion, urgencia, proveedor_sugerido, proveedor_id, centro_costo_id, items } = parsed.data;

  const anterior = { ...solicitud };

  await prisma.$transaction(async (tx) => {
    const updateData: Record<string, any> = {};
    if (titulo !== undefined) updateData.titulo = titulo;
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (justificacion !== undefined) updateData.justificacion = justificacion;
    if (urgencia !== undefined) updateData.urgencia = urgencia;
    if (proveedor_sugerido !== undefined) updateData.proveedor_sugerido = proveedor_sugerido ?? null;
    if (proveedor_id !== undefined) updateData.proveedor_id = proveedor_id ?? null;
    if (centro_costo_id !== undefined) updateData.centro_costo_id = centro_costo_id ?? null;

    if (Object.keys(updateData).length > 0) {
      await tx.solicitudes.update({ where: { id: solicitudId }, data: updateData });
    }

    if (items !== undefined) {
      await tx.items_solicitud.deleteMany({ where: { solicitud_id: solicitudId } });
      await tx.items_solicitud.createMany({
        data: items.map(item => ({
          tenant_id: session.tenantId,
          solicitud_id: solicitudId,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad: item.unidad ?? 'unidades',
          precio_estimado: item.precio_estimado ?? null,
          link_producto: item.link_producto || null,
        })),
      });
    }
  });

  await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'editar_solicitud', entidad: 'solicitud', entidadId: solicitudId, datosAnteriores: anterior, ipAddress: ip });

  return Response.json({ message: 'Solicitud actualizada' });
});
