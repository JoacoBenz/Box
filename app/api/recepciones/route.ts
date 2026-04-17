import { withAuth, validateBody } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';
import { recepcionSchema } from '@/lib/validators';
import { uploadFile } from '@/lib/supabase';
import { calcularMatching } from '@/lib/matching';
import { logApiError } from '@/lib/logger';
import { sincronizarProductos } from '@/lib/productos';

export const POST = withAuth(
  { roles: ['solicitante', 'responsable_area'] },
  async (request, { session, db, ip }) => {
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

    const parsed = validateBody(recepcionSchema, body);
    if (!parsed.success) return parsed.response;

    const { solicitud_id, conforme, tipo_problema, observaciones } = parsed.data;

    const solicitud = await db.solicitudes.findFirst({ where: { id: solicitud_id } });
    if (!solicitud)
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Solicitud no encontrada' } },
        { status: 404 },
      );
    if (solicitud.estado !== 'abonada') {
      return Response.json(
        {
          error: { code: 'BAD_REQUEST', message: 'Esta solicitud no está pendiente de recepción' },
        },
        { status: 400 },
      );
    }

    const esSolicitante = solicitud.solicitante_id === session.userId;
    const esDelArea = session.areaId === solicitud.area_id;
    if (!esSolicitante && !esDelArea) {
      return Response.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Solo el solicitante o alguien de su área puede confirmar recepción',
          },
        },
        { status: 403 },
      );
    }

    // Check: quien compró no puede confirmar
    const compra = await db.compras.findFirst({ where: { solicitud_id } });
    if (compra?.ejecutado_por_id === session.userId) {
      return Response.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Quien registró la compra no puede confirmar la recepción',
          },
        },
        { status: 403 },
      );
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
        const allFullyReceived = solicitudItems.every((item) => {
          const received = receivedByItem.get(item.id) ?? 0;
          return received >= Number(item.cantidad);
        });

        const hasProblems = body.items.some((item: any) => !item.conforme);

        // Set appropriate estado based on item-level data
        if (allFullyReceived && !hasProblems) {
          nuevoEstado = 'cerrada';
        } else if (allFullyReceived && hasProblems) {
          nuevoEstado = 'recibida_con_obs';
        } else {
          // Not fully received — keep as 'abonada' (partial receipt)
          nuevoEstado = 'abonada';
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

    // Auto-create/update productos when solicitud transitions to cerrada
    if (nuevoEstado === 'cerrada') {
      await sincronizarProductos(session.tenantId, solicitud_id).catch(() => {});
    }

    if (conforme) {
      await notificarPorRol(
        session.tenantId,
        'tesoreria',
        'Recepción confirmada',
        `${session.nombre} confirmó recepción de "${solicitud.titulo}"`,
        solicitud_id,
      );
      // Notificar cierre a todos los involucrados
      if (nuevoEstado === 'cerrada') {
        if (solicitud.solicitante_id !== session.userId) {
          await crearNotificacion({
            tenantId: session.tenantId,
            destinatarioId: solicitud.solicitante_id,
            tipo: 'solicitud_cerrada',
            titulo: 'Tu solicitud fue cerrada exitosamente',
            mensaje: `"${solicitud.titulo}" fue recibida y cerrada.`,
            solicitudId: solicitud_id,
          });
        }
        const areaRec = await db.areas.findFirst({
          where: { id: solicitud.area_id },
          select: { responsable_id: true },
        });
        if (
          areaRec?.responsable_id &&
          areaRec.responsable_id !== session.userId &&
          areaRec.responsable_id !== solicitud.solicitante_id
        ) {
          await crearNotificacion({
            tenantId: session.tenantId,
            destinatarioId: areaRec.responsable_id,
            tipo: 'solicitud_cerrada',
            titulo: 'Solicitud completada',
            mensaje: `"${solicitud.titulo}" fue recibida conforme y cerrada.`,
            solicitudId: solicitud_id,
          });
        }
        await notificarPorRol(
          session.tenantId,
          'director',
          'Solicitud completada',
          `"${solicitud.titulo}" fue recibida conforme y cerrada.`,
          solicitud_id,
        );
        await notificarPorRol(
          session.tenantId,
          'compras',
          'Solicitud completada',
          `"${solicitud.titulo}" fue recibida conforme y cerrada.`,
          solicitud_id,
        );
      }
    } else {
      await notificarPorRol(
        session.tenantId,
        'tesoreria',
        'Recepción con problemas',
        `${session.nombre} reportó problema (${tipo_problema}) con "${solicitud.titulo}": ${observaciones}`,
        solicitud_id,
      );
      // Notificar problema a todos los involucrados
      if (solicitud.solicitante_id !== session.userId) {
        await crearNotificacion({
          tenantId: session.tenantId,
          destinatarioId: solicitud.solicitante_id,
          tipo: 'recepcion_problema',
          titulo: 'Problema en la recepción',
          mensaje: `Se reportó un problema (${tipo_problema}) con "${solicitud.titulo}": ${observaciones}`,
          solicitudId: solicitud_id,
        });
      }
      const areaRec = await db.areas.findFirst({
        where: { id: solicitud.area_id },
        select: { responsable_id: true },
      });
      if (
        areaRec?.responsable_id &&
        areaRec.responsable_id !== session.userId &&
        areaRec.responsable_id !== solicitud.solicitante_id
      ) {
        await crearNotificacion({
          tenantId: session.tenantId,
          destinatarioId: areaRec.responsable_id,
          tipo: 'recepcion_problema',
          titulo: 'Problema en recepción',
          mensaje: `${session.nombre} reportó problema (${tipo_problema}) con "${solicitud.titulo}": ${observaciones}`,
          solicitudId: solicitud_id,
        });
      }
      await notificarPorRol(
        session.tenantId,
        'director',
        'Problema en recepción',
        `${session.nombre} reportó problema (${tipo_problema}) con "${solicitud.titulo}": ${observaciones}`,
        solicitud_id,
      );
      await notificarPorRol(
        session.tenantId,
        'compras',
        'Problema en recepción',
        `${session.nombre} reportó problema (${tipo_problema}) con "${solicitud.titulo}": ${observaciones}`,
        solicitud_id,
      );
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
          solicitudFull.items_solicitud,
        );

        if (!matching.matched) {
          await notificarPorRol(
            session.tenantId,
            'tesoreria',
            `Discrepancia en recepción SC-${solicitudFull.numero}`,
            matching.discrepancies.join('; '),
            body.solicitud_id,
          );
        }
      }
    }

    await registrarAuditoria({
      tenantId: session.tenantId,
      usuarioId: session.userId,
      accion: 'confirmar_recepcion',
      entidad: 'recepcion',
      entidadId: solicitud_id,
      datosNuevos: { conforme, tipo_problema },
      ipAddress: ip,
    });
    return Response.json(
      {
        message: conforme
          ? 'Recepción confirmada y solicitud cerrada'
          : 'Recepción registrada con observaciones',
      },
      { status: 201 },
    );
  },
);
