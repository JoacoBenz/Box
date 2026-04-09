import { withAdminOverride, withAuth, validateBody } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';
import { solicitudSchema } from '@/lib/validators';
import { getTenantConfigBool } from '@/lib/tenant-config';
import { verificarResponsableDeArea } from '@/lib/permissions';

async function generarNumeroSolicitud(tenantId: number): Promise<string> {
  const año = new Date().getFullYear();
  const prefijo = `SC-${año}-`;
  const result = await prisma.$queryRaw<{ numero: string }[]>`
    SELECT numero FROM solicitudes
    WHERE tenant_id = ${tenantId} AND numero LIKE ${prefijo + '%'}
    ORDER BY numero DESC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  `;
  let secuencia = 1;
  if (result.length > 0) {
    const partes = result[0].numero.split('-');
    secuencia = parseInt(partes[2], 10) + 1;
  }
  return `${prefijo}${secuencia.toString().padStart(4, '0')}`;
}

export const GET = withAdminOverride({}, async (request, { session, db, effectiveTenantId }) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'));
  const skip = (page - 1) * limit;
  const estado = searchParams.get('estado') || undefined;
  const urgencia = searchParams.get('urgencia') || undefined;
  const areaId = searchParams.get('area_id') ? parseInt(searchParams.get('area_id')!) : undefined;
  const solicitanteId = searchParams.get('solicitante_id') ? parseInt(searchParams.get('solicitante_id')!) : undefined;
  const busqueda = searchParams.get('busqueda') || undefined;
  const desde = searchParams.get('desde') || undefined;
  const hasta = searchParams.get('hasta') || undefined;
  const orden = searchParams.get('orden') || 'created_at';
  const direccion = (searchParams.get('direccion') || 'desc') as 'asc' | 'desc';

  const where: any = {};

  // Role-based visibility filter
  if (session.roles.includes('director') || session.roles.includes('tesoreria') || session.roles.includes('compras') || session.roles.includes('admin') || session.roles.includes('super_admin')) {
    // sees all
  } else if (session.roles.includes('responsable_area')) {
    // Find all areas where this user is the designated responsable
    const areasResponsable = await db.areas.findMany({
      where: { responsable_id: session.userId, activo: true },
      select: { id: true },
    });
    const areaIds = areasResponsable.map(a => a.id);
    if (areaIds.length > 0) {
      // Show requests from areas they're responsible for, plus their own
      where.OR = [
        { area_id: { in: areaIds } },
        { solicitante_id: session.userId },
      ];
    } else {
      where.solicitante_id = session.userId;
    }
  } else {
    where.solicitante_id = session.userId;
  }

  if (estado) {
    const estados = estado.split(',').map(e => e.trim()).filter(Boolean);
    where.estado = estados.length === 1 ? estados[0] : { in: estados };
  }
  if (areaId) where.area_id = areaId;
  if (solicitanteId) where.solicitante_id = solicitanteId;
  if (desde || hasta) {
    where.created_at = {};
    if (desde) where.created_at.gte = new Date(desde + 'T00:00:00');
    if (hasta) where.created_at.lte = new Date(hasta + 'T23:59:59');
  }
  if (busqueda) {
    const busquedaCondition = [
      { titulo: { contains: busqueda, mode: 'insensitive' as const } },
      { descripcion: { contains: busqueda, mode: 'insensitive' as const } },
      { numero: { contains: busqueda, mode: 'insensitive' as const } },
    ];
    if (where.OR) {
      // Wrap existing role-based OR with AND to preserve both conditions
      const roleFilter = { OR: where.OR };
      delete where.OR;
      where.AND = [roleFilter, { OR: busquedaCondition }];
    } else {
      where.OR = busquedaCondition;
    }
  }

  const [data, total] = await Promise.all([
    db.solicitudes.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [orden]: direccion },
      include: {
        solicitante: { select: { id: true, nombre: true } },
        area: { select: { id: true, nombre: true } },
        centro_costo: { select: { id: true, nombre: true, codigo: true } },
        items_solicitud: { select: { precio_estimado: true, cantidad: true } },
      },
    }),
    db.solicitudes.count({ where }),
  ]);

  return Response.json({ data, total, page, totalPages: Math.ceil(total / limit) });
});

export const POST = withAuth({ roles: ['solicitante'] }, async (request, { session, ip }) => {
  if (!session.areaId) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: 'Tu cuenta no tiene un área asignada. Contactá al administrador.' } }, { status: 400 });
  }

  const body = await request.json();
  const enviar = body.enviar === true || body.accion === 'enviar';
  const parsed = validateBody(solicitudSchema, body);
  if (!parsed.success) return parsed.response;

  const { titulo, descripcion, justificacion, urgencia, proveedor_sugerido, proveedor_id, centro_costo_id, items } = parsed.data;

  const solicitud = await prisma.$transaction(async (tx) => {
    const numero = await generarNumeroSolicitud(session.tenantId);
    const estado = enviar ? 'enviada' : 'borrador';

    const nueva = await tx.solicitudes.create({
      data: {
        tenant_id: session.tenantId,
        numero,
        titulo,
        descripcion,
        justificacion,
        urgencia,
        proveedor_sugerido: proveedor_sugerido ?? null,
        proveedor_id: proveedor_id ?? null,
        centro_costo_id: centro_costo_id ?? null,
        solicitante_id: session.userId,
        area_id: session.areaId!,
        estado,
        fecha_envio: enviar ? new Date() : null,
      },
    });

    await tx.items_solicitud.createMany({
      data: items.map(item => ({
        tenant_id: session.tenantId,
        solicitud_id: nueva.id,
        producto_id: item.producto_id ?? null,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        unidad: item.unidad ?? 'unidades',
        precio_estimado: item.precio_estimado ?? null,
        link_producto: item.link_producto || null,
      })),
    });

    return nueva;
  });

  if (enviar) {
    const esResponsableDelArea = session.roles.includes('responsable_area')
      && await verificarResponsableDeArea(session.tenantId, session.userId, session.areaId!);
    const requiereValidacion = await getTenantConfigBool(session.tenantId, 'requiere_validacion_responsable', true);
    const skipValidacion = !requiereValidacion || esResponsableDelArea;

    if (skipValidacion) {
      // Auto-validate: go directly to validada for director approval
      await prisma.solicitudes.update({
        where: { id: solicitud.id },
        data: {
          estado: 'validada',
          validado_por_id: esResponsableDelArea ? session.userId : null,
          fecha_validacion: esResponsableDelArea ? new Date() : null,
        },
      });
      if (esResponsableDelArea) {
        await registrarAuditoria({
          tenantId: session.tenantId, usuarioId: session.userId,
          accion: 'validar_solicitud', entidad: 'solicitud', entidadId: solicitud.id,
          datosNuevos: { automatico: true },
          ipAddress: ip,
        });
      }
      await notificarPorRol(session.tenantId, 'director', 'Nueva solicitud para aprobar', `${session.nombre} solicita: ${titulo}`, solicitud.id);
    } else {
      const area = await prisma.areas.findFirst({ where: { id: session.areaId!, tenant_id: session.tenantId } });
      if (!area?.responsable_id) {
        await notificarPorRol(session.tenantId, 'director', 'Área sin responsable', `La solicitud "${titulo}" fue enviada pero el área no tiene responsable asignado. Asigná uno para que pueda ser validada.`, solicitud.id);
      } else {
        await crearNotificacion({
          tenantId: session.tenantId,
          destinatarioId: area.responsable_id,
          tipo: 'solicitud_enviada',
          titulo: `Nueva solicitud para validar`,
          mensaje: `${session.nombre} solicita: ${titulo}`,
          solicitudId: solicitud.id,
        });
      }
    }
  }

  if (enviar && (urgencia === 'critica' || urgencia === 'urgente')) {
    const esCritica = urgencia === 'critica'
    const tituloUrgencia = esCritica ? '🚨 Solicitud CRÍTICA enviada' : '⚠️ Solicitud urgente enviada'
    const mensajeUrgencia = `${session.nombre} marcó como ${urgencia}: "${titulo}". Requiere atención prioritaria.`

    const areaUrgencia = await prisma.areas.findFirst({ where: { id: session.areaId!, tenant_id: session.tenantId } })
    const urgencyNotifications: Promise<any>[] = [
      notificarPorRol(session.tenantId, 'tesoreria', tituloUrgencia, mensajeUrgencia, solicitud.id),
      notificarPorRol(session.tenantId, 'compras', tituloUrgencia, mensajeUrgencia, solicitud.id),
    ];
    if (areaUrgencia?.responsable_id) {
      urgencyNotifications.push(crearNotificacion({
        tenantId: session.tenantId,
        destinatarioId: areaUrgencia.responsable_id,
        tipo: `solicitud_${urgencia}`,
        titulo: tituloUrgencia,
        mensaje: mensajeUrgencia,
        solicitudId: solicitud.id,
      }));
    }
    await Promise.all(urgencyNotifications)
  }

  await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: enviar ? 'enviar_solicitud' : 'crear_borrador', entidad: 'solicitud', entidadId: solicitud.id, ipAddress: ip });

  return Response.json(solicitud, { status: 201 });
});
