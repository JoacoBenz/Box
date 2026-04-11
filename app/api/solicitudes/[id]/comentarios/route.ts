import { NextResponse } from 'next/server';
import { withAdminOverride, withTenant } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/permissions';
import { crearNotificacion } from '@/lib/notifications';
import { registrarAuditoria } from '@/lib/audit';
import { logApiError } from '@/lib/logger';

export const GET = withAdminOverride({}, async (_request, { db }, params) => {
  const solicitudId = Number(params.id);
  if (isNaN(solicitudId)) return apiError('VALIDATION', 'ID inválido', 400);

  // Verify solicitud exists within the tenant scope
  const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
  if (!solicitud) return apiError('NOT_FOUND', 'Solicitud no encontrada', 404);

  const comentarios = await db.comentarios.findMany({
    where: { solicitud_id: solicitudId },
    include: {
      usuario: { select: { id: true, nombre: true } },
    },
    orderBy: { created_at: 'asc' },
  });

  return NextResponse.json(comentarios);
});

export const POST = withTenant(async (request, { session, db }, params) => {
  const solicitudId = Number(params.id);
  if (isNaN(solicitudId)) return apiError('VALIDATION', 'ID inválido', 400);

  const body = await request.json();
  const mensaje = body.mensaje?.trim();

  if (!mensaje || mensaje.length < 1) {
    return apiError('VALIDATION', 'El comentario no puede estar vacío', 400);
  }
  if (mensaje.length > 2000) {
    return apiError('VALIDATION', 'El comentario no puede superar los 2000 caracteres', 400);
  }

  // Verify solicitud exists
  const solicitud = await db.solicitudes.findFirst({
    where: { id: solicitudId },
  });
  if (!solicitud) return apiError('NOT_FOUND', 'Solicitud no encontrada', 404);

  // Permission check: user must be involved with this solicitud
  const { userId, roles } = session;
  const hasGlobalAccess = roles.includes('director') || roles.includes('tesoreria') || roles.includes('compras') || roles.includes('admin') || roles.includes('super_admin');
  if (!hasGlobalAccess) {
    const isOwner = solicitud.solicitante_id === userId;
    const isResponsable = roles.includes('responsable_area') && await (async () => {
      const area = await prisma.areas.findFirst({ where: { id: solicitud.area_id, tenant_id: session.tenantId, responsable_id: userId } });
      return !!area;
    })();
    if (!isOwner && !isResponsable) {
      return apiError('FORBIDDEN', 'No tenés acceso a esta solicitud', 403);
    }
  }

  const comentario = await db.comentarios.create({
    data: {
      tenant_id: session.tenantId,
      solicitud_id: solicitudId,
      usuario_id: session.userId,
      mensaje,
    },
    include: { usuario: { select: { id: true, nombre: true } } },
  });

  // ── Notificaciones: notificar a todos los involucrados en el flujo ──
  const userName = comentario.usuario.nombre;
  const solNumero = solicitud.numero;
  const titulo = `Nuevo comentario en ${solNumero}`;
  const msgTexto = mensaje.length > 80 ? mensaje.substring(0, 80) + '…' : mensaje;
  const notifMensaje = `${userName}: ${msgTexto}`;

  const destinatarios = new Set<number>();

  // 1. Always notify the solicitante (unless they are the commenter)
  if (solicitud.solicitante_id !== userId) {
    destinatarios.add(solicitud.solicitante_id);
  }

  // 2. Notify all roles involved in the flow: responsable_area (same area only), director, compras, tesoreria
  const usersWithRoles = await prisma.usuarios.findMany({
    where: {
      tenant_id: session.tenantId,
      activo: true,
      OR: [
        // responsable_area: only those in the solicitud's area
        { area_id: solicitud.area_id, usuarios_roles: { some: { rol: { nombre: 'responsable_area' } } } },
        // director, compras, tesoreria: no area filter
        { usuarios_roles: { some: { rol: { nombre: { in: ['director', 'compras', 'tesoreria'] } } } } },
      ],
    },
    select: { id: true },
  });

  for (const u of usersWithRoles) {
    if (u.id !== userId) destinatarios.add(u.id);
  }

  // Create all notifications (fire and forget, with logging)
  const notifPromises = Array.from(destinatarios).map((destId) =>
    crearNotificacion({
      tenantId: session.tenantId,
      destinatarioId: destId,
      tipo: 'comentario',
      titulo,
      mensaje: notifMensaje,
      solicitudId: solicitudId,
    })
  );
  Promise.all(notifPromises).catch((err) => {
    logApiError('comentarios', 'notifications', err, userId, session.tenantId);
  });

  // Audit log
  registrarAuditoria({
    tenantId: session.tenantId, usuarioId: userId,
    accion: 'crear_comentario', entidad: 'comentario', entidadId: comentario.id,
    datosNuevos: { solicitudId, mensaje: msgTexto },
  }).catch(() => {}); // Non-critical, fire and forget

  return NextResponse.json(comentario, { status: 201 });
});
