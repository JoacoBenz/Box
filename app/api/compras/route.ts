import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { verificarRol, verificarSegregacion } from '@/lib/permissions';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { crearNotificacion } from '@/lib/notifications';
import { compraSchema } from '@/lib/validators';
import { uploadFile } from '@/lib/supabase';
import { logApiError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['tesoreria', 'compras', 'solicitante'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'No tenés permiso para registrar compras' } }, { status: 403 });
    }

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

    const result = compraSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } }, { status: 400 });
    }

    if (!archivo) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'El comprobante de pago es obligatorio' } }, { status: 400 });
    }

    const { medio_pago, referencia_bancaria } = result.data;
    if (['transferencia', 'cheque'].includes(medio_pago) && !referencia_bancaria) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'La referencia bancaria es obligatoria para transferencias y cheques' } }, { status: 400 });
    }

    const db = tenantPrisma(session.tenantId);

    // Duplicate numero_factura check (per tenant)
    if (result.data.numero_factura) {
      const facturaExistente = await db.compras.findFirst({
        where: { numero_factura: result.data.numero_factura },
        include: { solicitud: { select: { numero: true } } },
      });
      if (facturaExistente) {
        return Response.json({
          error: {
            code: 'DUPLICATE',
            message: `Ya existe una compra registrada con la factura ${result.data.numero_factura} (solicitud ${facturaExistente.solicitud?.numero ?? facturaExistente.solicitud_id})`,
          },
        }, { status: 409 });
      }
    }

    const solicitud = await db.solicitudes.findFirst({
      where: { id: result.data.solicitud_id },
      include: { proveedor: true },
    });
    if (!solicitud) return Response.json({ error: { code: 'NOT_FOUND', message: 'Solicitud no encontrada' } }, { status: 404 });
    const estadosPermitidos = ['aprobada', 'pago_programado', 'en_compras'];
    if (!estadosPermitidos.includes(solicitud.estado)) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Esta solicitud no está lista para registrar la compra' } }, { status: 400 });
    }

    const seg = verificarSegregacion(solicitud, session.userId, 'comprar');
    if (!seg.permitido) return Response.json({ error: { code: 'FORBIDDEN', message: seg.motivo } }, { status: 403 });

    // Validate file type
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(archivo.type)) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Tipo de archivo no permitido. Usá PDF, JPG o PNG.' } }, { status: 400 });
    }
    if (archivo.size > 10 * 1024 * 1024) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'El archivo no puede superar los 10MB' } }, { status: 400 });
    }

    const compra = await prisma.$transaction(async (tx) => {
      const nuevaCompra = await tx.compras.create({
        data: {
          tenant_id: session.tenantId,
          solicitud_id: result.data.solicitud_id,
          ejecutado_por_id: session.userId,
          proveedor_id: result.data.proveedor_id ?? solicitud.proveedor_id ?? null,
          proveedor_nombre: result.data.proveedor_nombre,
          proveedor_detalle: result.data.proveedor_detalle ?? null,
          fecha_compra: new Date(result.data.fecha_compra),
          monto_total: result.data.monto_total,
          medio_pago: result.data.medio_pago,
          referencia_bancaria: result.data.referencia_bancaria ?? null,
          numero_factura: result.data.numero_factura ?? null,
          observaciones: result.data.observaciones ?? null,
        },
      });

      await tx.solicitudes.update({ where: { id: result.data.solicitud_id }, data: { estado: 'comprada' } });

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
      uploadWarning = 'La compra se registró correctamente, pero el comprobante no pudo subirse. Podés adjuntarlo después.';
    }

    await crearNotificacion({ tenantId: session.tenantId, destinatarioId: solicitud.solicitante_id, tipo: 'compra_registrada', titulo: 'Tu pedido fue comprado', mensaje: `Tesorería compró "${solicitud.titulo}" a ${result.data.proveedor_nombre} por $${result.data.monto_total}. Confirmá la recepción cuando lo recibas.`, solicitudId: solicitud.id });

    const area = await prisma.areas.findFirst({ where: { id: solicitud.area_id, tenant_id: session.tenantId } });
    if (area?.responsable_id && area.responsable_id !== solicitud.solicitante_id) {
      await crearNotificacion({ tenantId: session.tenantId, destinatarioId: area.responsable_id, tipo: 'compra_registrada', titulo: 'Compra ejecutada', mensaje: `"${solicitud.titulo}" fue comprado. Pendiente de recepción.`, solicitudId: solicitud.id });
    }

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'registrar_compra', entidad: 'compra', entidadId: compra.id, ipAddress: getClientIp(request) });
    return Response.json({ ...compra, warning: uploadWarning }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    logApiError('/api/compras', 'POST', error);
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
