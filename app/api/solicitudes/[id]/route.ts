import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { solicitudSchema } from '@/lib/validators';
import { registrarAuditoria } from '@/lib/audit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    const { id } = await params;
    const solicitudId = parseInt(id);
    const db = tenantPrisma(session.tenantId);

    const solicitud = await db.solicitudes.findFirst({
      where: { id: solicitudId },
      include: {
        solicitante: { select: { id: true, nombre: true, email: true } },
        area: { select: { id: true, nombre: true } },
        validado_por: { select: { id: true, nombre: true } },
        aprobado_por: { select: { id: true, nombre: true } },
        rechazado_por: { select: { id: true, nombre: true } },
        proveedor: true,
        items_solicitud: true,
        compras: { include: { ejecutado_por: { select: { id: true, nombre: true } } } },
        recepciones: { include: { receptor: { select: { id: true, nombre: true } } } },
      },
    });

    if (!solicitud) return Response.json({ error: { code: 'NOT_FOUND', message: 'Solicitud no encontrada' } }, { status: 404 });

    const { userId, roles, areaId } = session;
    const esSolicitante = solicitud.solicitante_id === userId;
    const esResponsableArea = solicitud.area_id === areaId;
    const tieneAcceso = esSolicitante || esResponsableArea || roles.includes('director') || roles.includes('tesoreria') || roles.includes('admin');
    if (!tieneAcceso) return Response.json({ error: { code: 'FORBIDDEN', message: 'Sin acceso a esta solicitud' } }, { status: 403 });

    // Add archivos
    const archivos = await prisma.archivos.findMany({
      where: { tenant_id: session.tenantId, entidad: 'solicitud', entidad_id: solicitudId },
    });

    return Response.json({ ...solicitud, archivos });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    const { id } = await params;
    const solicitudId = parseInt(id);
    const db = tenantPrisma(session.tenantId);

    const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
    if (!solicitud) return Response.json({ error: { code: 'NOT_FOUND', message: 'No encontrada' } }, { status: 404 });
    if (!['borrador', 'devuelta_resp', 'devuelta_dir'].includes(solicitud.estado)) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Solo se pueden editar solicitudes en borrador o devueltas' } }, { status: 400 });
    }
    if (solicitud.solicitante_id !== session.userId) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo el solicitante puede editar' } }, { status: 403 });
    }

    const body = await request.json();
    const result = solicitudSchema.partial().safeParse(body);
    if (!result.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } }, { status: 400 });
    }

    // Validate items array individually if provided
    if (result.data.items !== undefined && result.data.items.length === 0) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: [{ field: 'items', message: 'Agregá al menos un ítem' }] } }, { status: 400 });
    }

    const { titulo, descripcion, justificacion, urgencia, proveedor_sugerido, proveedor_id, items } = result.data;

    const anterior = { ...solicitud };

    await prisma.$transaction(async (tx) => {
      const updateData: Record<string, any> = {};
      if (titulo !== undefined) updateData.titulo = titulo;
      if (descripcion !== undefined) updateData.descripcion = descripcion;
      if (justificacion !== undefined) updateData.justificacion = justificacion;
      if (urgencia !== undefined) updateData.urgencia = urgencia;
      if (proveedor_sugerido !== undefined) updateData.proveedor_sugerido = proveedor_sugerido ?? null;
      if (proveedor_id !== undefined) updateData.proveedor_id = proveedor_id ?? null;

      if (items !== undefined) {
        const montoTotal = items.reduce((acc, item) => acc + (item.precio_estimado ? Number(item.precio_estimado) * Number(item.cantidad) : 0), 0);
        updateData.monto_estimado_total = montoTotal > 0 ? montoTotal : null;
      }

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

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'editar_solicitud', entidad: 'solicitud', entidadId: solicitudId, datosAnteriores: anterior });

    return Response.json({ message: 'Solicitud actualizada' });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
