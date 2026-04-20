import { withAuth, validateBody } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { verificarSegregacion } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';
import { compraSchema } from '@/lib/validators';
import { uploadFile } from '@/lib/supabase';
import { logApiError } from '@/lib/logger';
import { verificarPresupuestoArea } from '@/lib/budget-control';

export const POST = withAuth(
  { roles: ['tesoreria', 'compras', 'solicitante'] },
  async (request, { session, db, ip }) => {
    const formData = await request.formData();
    const archivo = formData.get('comprobante') as File | null;

    const body = {
      solicitud_id: parseInt(formData.get('solicitud_id') as string),
      proveedor_nombre: formData.get('proveedor_nombre'),
      proveedor_detalle: formData.get('proveedor_detalle') || null,
      fecha_compra: formData.get('fecha_compra'),
      monto_total: parseFloat(formData.get('monto_total') as string),
      medio_pago: formData.get('medio_pago'),
      referencia_bancaria: formData.get('referencia_bancaria') || null,
      numero_factura: formData.get('numero_factura') || null,
      observaciones: formData.get('observaciones') || null,
    };

    const parsed = validateBody(compraSchema, body);
    if (!parsed.success) return parsed.response;

    if (!archivo) {
      return Response.json(
        { error: { code: 'BAD_REQUEST', message: 'El comprobante de pago es obligatorio' } },
        { status: 400 },
      );
    }

    const { medio_pago, referencia_bancaria } = parsed.data;
    if (['transferencia', 'cheque'].includes(medio_pago) && !referencia_bancaria) {
      return Response.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'La referencia bancaria es obligatoria para transferencias y cheques',
          },
        },
        { status: 400 },
      );
    }

    // Duplicate numero_factura check (per tenant)
    if (parsed.data.numero_factura) {
      const facturaExistente = await db.compras.findFirst({
        where: { numero_factura: parsed.data.numero_factura },
        include: { solicitud: { select: { numero: true } } },
      });
      if (facturaExistente) {
        return Response.json(
          {
            error: {
              code: 'DUPLICATE',
              message: `Ya existe una compra registrada con la factura ${parsed.data.numero_factura} (solicitud ${facturaExistente.solicitud?.numero ?? facturaExistente.solicitud_id})`,
            },
          },
          { status: 409 },
        );
      }
    }

    const solicitud = await db.solicitudes.findFirst({
      where: { id: parsed.data.solicitud_id },
      select: {
        id: true,
        estado: true,
        solicitante_id: true,
        validado_por_id: true,
        aprobado_por_id: true,
        proveedor_id: true,
        area_id: true,
        titulo: true,
        numero: true,
      },
    });
    if (!solicitud)
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Solicitud no encontrada' } },
        { status: 404 },
      );
    const estadosPermitidos = ['pago_programado', 'aprobada'];
    if (!estadosPermitidos.includes(solicitud.estado)) {
      return Response.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'Esta solicitud no está lista para registrar la compra',
          },
        },
        { status: 400 },
      );
    }

    const seg = verificarSegregacion(solicitud, session.userId, 'comprar');
    if (!seg.permitido)
      return Response.json({ error: { code: 'FORBIDDEN', message: seg.motivo } }, { status: 403 });

    // Validate file type
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(archivo.type)) {
      return Response.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'Tipo de archivo no permitido. Usá PDF, JPG o PNG.',
          },
        },
        { status: 400 },
      );
    }
    if (archivo.size > 10 * 1024 * 1024) {
      return Response.json(
        { error: { code: 'BAD_REQUEST', message: 'El archivo no puede superar los 10MB' } },
        { status: 400 },
      );
    }

    // Budget check — block if area budget would be exceeded
    const budgetCheck = await verificarPresupuestoArea(
      session.tenantId,
      solicitud.area_id,
      parsed.data.monto_total,
    );
    if (!budgetCheck.permitido) {
      return Response.json(
        { error: { code: 'BUDGET_EXCEEDED', message: budgetCheck.mensaje } },
        { status: 422 },
      );
    }

    const compra = await prisma.$transaction(async (tx) => {
      const nuevaCompra = await tx.compras.create({
        data: {
          tenant_id: session.tenantId,
          solicitud_id: parsed.data.solicitud_id,
          ejecutado_por_id: session.userId,
          proveedor_id: parsed.data.proveedor_id ?? solicitud.proveedor_id ?? null,
          proveedor_nombre: parsed.data.proveedor_nombre,
          proveedor_detalle: parsed.data.proveedor_detalle ?? null,
          fecha_compra: new Date(parsed.data.fecha_compra),
          monto_total: parsed.data.monto_total,
          medio_pago: parsed.data.medio_pago,
          referencia_bancaria: parsed.data.referencia_bancaria ?? null,
          numero_factura: parsed.data.numero_factura ?? null,
          observaciones: parsed.data.observaciones ?? null,
        },
      });

      await tx.solicitudes.update({
        where: { id: parsed.data.solicitud_id },
        data: { estado: 'abonada' },
      });

      return nuevaCompra;
    });

    // Upload file after transaction
    let uploadWarning: string | null = null;
    try {
      const { path } = await uploadFile(session.tenantId, 'comprobantes', compra.id, archivo);
      await prisma.archivos.create({
        data: {
          tenant_id: session.tenantId,
          entidad: 'compra',
          entidad_id: compra.id,
          nombre_archivo: archivo.name,
          ruta_archivo: path,
          tamanio_bytes: archivo.size,
          subido_por_id: session.userId,
        },
      });
    } catch (uploadErr) {
      logApiError('/api/compras', 'POST', uploadErr);
      uploadWarning =
        'La compra se registró correctamente, pero el comprobante no pudo subirse. Podés adjuntarlo después.';
    }

    await crearNotificacion({
      tenantId: session.tenantId,
      destinatarioId: solicitud.solicitante_id,
      tipo: 'compra_registrada',
      titulo: 'Tu pedido fue comprado',
      mensaje: `Se abonó "${solicitud.titulo}" a ${parsed.data.proveedor_nombre} por $${parsed.data.monto_total}. Confirmá la recepción cuando lo recibas.`,
      solicitudId: solicitud.id,
    });

    const area = await prisma.areas.findFirst({
      where: { id: solicitud.area_id, tenant_id: session.tenantId },
    });
    if (area?.responsable_id && area.responsable_id !== solicitud.solicitante_id) {
      await crearNotificacion({
        tenantId: session.tenantId,
        destinatarioId: area.responsable_id,
        tipo: 'compra_registrada',
        titulo: 'Compra ejecutada',
        mensaje: `"${solicitud.titulo}" fue comprado. Pendiente de recepción.`,
        solicitudId: solicitud.id,
      });
    }

    // Notificar a Director y Compras de que se ejecutó el pago
    await notificarPorRol(
      session.tenantId,
      'director',
      'Compra ejecutada',
      `Tesorería abonó "${solicitud.titulo}" a ${parsed.data.proveedor_nombre} por $${parsed.data.monto_total}`,
      solicitud.id,
    );
    await notificarPorRol(
      session.tenantId,
      'compras',
      'Compra ejecutada',
      `Se abonó "${solicitud.titulo}" a ${parsed.data.proveedor_nombre} por $${parsed.data.monto_total}`,
      solicitud.id,
    );

    await registrarAuditoria({
      tenantId: session.tenantId,
      usuarioId: session.userId,
      accion: 'registrar_compra',
      entidad: 'compra',
      entidadId: compra.id,
      ipAddress: ip,
    });
    return Response.json({ ...compra, warning: uploadWarning }, { status: 201 });
  },
);
