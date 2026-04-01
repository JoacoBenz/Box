import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { verificarRol } from '@/lib/permissions';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';
import { recepcionSchema } from '@/lib/validators';
import { uploadFile } from '@/lib/supabase';
import { calcularMatching } from '@/lib/matching';
import { logApiError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['solicitante', 'responsable_area'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Sin permiso para confirmar recepción' } }, { status: 403 });
    }

    const contentType = request.headers.get('content-type') ?? '';
    let body: any;
    let remito: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      remito = formData.get('remito') as File | null;
      body = {
        solicitud_id: parseInt(formData.get('solicitud_id') as string),
        conforme: formData.get('conforme') === 'true',
        tipo_problema: formData.get('tipo_problema') || null,
        observaciones: formData.get('observaciones') || null,
      };
    } else {
      body = await request.json();
    }

    const result = recepcionSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } }, { status: 400 });
    }

    const { solicitud_id, conforme, tipo_problema, observaciones } = result.data;
    const db = tenantPrisma(session.tenantId);

    const solicitud = await db.solicitudes.findFirst({ where: { id: solicitud_id } });
    if (!solicitud) return Response.json({ error: { code: 'NOT_FOUND', message: 'Solicitud no encontrada' } }, { status: 404 });
    if (solicitud.estado !== 'comprada') {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Esta solicitud no está pendiente de recepción' } }, { status: 400 });
    }

    const esSolicitante = solicitud.solicitante_id === session.userId;
    const esDelArea = session.areaId === solicitud.area_id;
    if (!esSolicitante && !esDelArea) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo el solicitante o alguien de su área puede confirmar recepción' } }, { status: 403 });
    }

    // Check: quien compró no puede confirmar
    const compra = await db.compras.findFirst({ where: { solicitud_id } });
    if (compra?.ejecutado_por_id === session.userId) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Quien registró la compra no puede confirmar la recepción' } }, { status: 403 });
    }

    let nuevoEstado = conforme ? 'cerrada' : 'recibida_con_obs';

    const recepcion = await prisma.$transaction(async (tx) => {
      const rec = await tx.recepciones.create({
        data: {
          tenant_id: session.tenantId,
          solicitud_id,
          receptor_id: session.userId,
          conforme,
          tipo_problema: tipo_problema ?? null,
          observaciones: observaciones ?? null,
        },
      });

      // Create item-level receipt records if provided
      if (body.items && Array.isArray(body.items) && body.items.length > 0) {
        // Validate that all item_solicitud_id values belong to this solicitud
        const solicitudItems = await tx.items_solicitud.findMany({
          where: { solicitud_id: body.solicitud_id },
          select: { id: true },
        });
        const validItemIds = new Set(solicitudItems.map(i => i.id));
        const invalidItems = body.items.filter((item: any) => !validItemIds.has(item.item_solicitud_id));
        if (invalidItems.length > 0) {
          throw new Error('INVALID_ITEMS');
        }

        await tx.items_recepcion.createMany({
          data: body.items.map((item: any) => ({
            tenant_id: session.tenantId,
            recepcion_id: rec.id,
            item_solicitud_id: item.item_solicitud_id,
            cantidad_recibida: item.cantidad_recibida,
            conforme: item.conforme ?? true,
            observaciones: item.observaciones || null,
          })),
        });

        // Check if all items are fully received
        const solicitudItems = await tx.items_solicitud.findMany({
          where: { solicitud_id: body.solicitud_id },
        });

        // Get all receipt items for this solicitud (across ALL recepciones)
        const allReceiptItems = await tx.items_recepcion.findMany({
          where: {
            item_solicitud: { solicitud_id: body.solicitud_id },
          },
        });

        // Calculate total received per item
        const receivedByItem = new Map<number, number>();
        for (const ri of allReceiptItems) {
          const current = receivedByItem.get(ri.item_solicitud_id) ?? 0;
          receivedByItem.set(ri.item_solicitud_id, current + Number(ri.cantidad_recibida));
        }

        // Determine if fully received or partial
        const allFullyReceived = solicitudItems.every(item => {
          const received = receivedByItem.get(item.id) ?? 0;
          return received >= Number(item.cantidad);
        });

        const hasProblems = body.items.some((item: any) => !item.conforme);

        // Set appropriate estado based on item-level data
        if (allFullyReceived && !hasProblems) {
          nuevoEstado = 'recibida';
        } else if (allFullyReceived && hasProblems) {
          nuevoEstado = 'recibida_con_obs';
        } else {
          // Not fully received — keep as 'comprada' (partial receipt)
          nuevoEstado = 'comprada';
        }
      }

      await tx.solicitudes.update({ where: { id: solicitud_id }, data: { estado: nuevoEstado } });
      return rec;
    });

    // Upload remito file if provided
    if (remito) {
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (allowed.includes(remito.type) && remito.size <= 10 * 1024 * 1024) {
        try {
          const { path } = await uploadFile(session.tenantId, 'remitos', recepcion.id, remito);
          await prisma.archivos.create({
            data: {
              tenant_id: session.tenantId,
              entidad: 'recepcion',
              entidad_id: recepcion.id,
              nombre_archivo: remito.name,
              ruta_archivo: path,
              tamanio_bytes: remito.size,
              subido_por_id: session.userId,
            },
          });
        } catch (uploadErr) {
          logApiError('/api/recepciones', 'POST', uploadErr);
        }
      }
    }

    if (conforme) {
      await notificarPorRol(session.tenantId, 'tesoreria', 'Recepción confirmada', `${session.nombre} confirmó recepción de "${solicitud.titulo}"`, solicitud_id);
    } else {
      await notificarPorRol(session.tenantId, 'tesoreria', 'Recepción con problemas', `${session.nombre} reportó problema (${tipo_problema}) con "${solicitud.titulo}": ${observaciones}`, solicitud_id);
    }

    // 3-way matching check
    if (body.items && body.items.length > 0) {
      const solicitudFull = await db.solicitudes.findFirst({
        where: { id: body.solicitud_id },
        include: {
          items_solicitud: true,
          compras: { take: 1, orderBy: { created_at: 'desc' } },
        },
      });

      if (solicitudFull) {
        const allReceiptItems = await db.items_recepcion.findMany({
          where: { item_solicitud: { solicitud_id: body.solicitud_id } },
        });

        const matching = calcularMatching(
          solicitudFull,
          solicitudFull.compras[0] ?? null,
          allReceiptItems,
          solicitudFull.items_solicitud
        );

        if (!matching.matched) {
          await notificarPorRol(
            session.tenantId,
            'tesoreria',
            `Discrepancia en recepción SC-${solicitudFull.numero}`,
            matching.discrepancies.join('; '),
            body.solicitud_id
          );
        }
      }
    }

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'confirmar_recepcion', entidad: 'recepcion', entidadId: solicitud_id, datosNuevos: { conforme, tipo_problema }, ipAddress: getClientIp(request) });
    return Response.json({ message: conforme ? 'Recepción confirmada y solicitud cerrada' : 'Recepción registrada con observaciones' }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    if (error.message === 'INVALID_ITEMS') return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Uno o más ítems no pertenecen a esta solicitud' } }, { status: 400 });
    logApiError('/api/recepciones', 'POST', error);
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
