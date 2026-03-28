import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { verificarRol } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';
import { recepcionSchema } from '@/lib/validators';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['solicitante', 'responsable_area'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Sin permiso para confirmar recepción' } }, { status: 403 });
    }

    const body = await request.json();
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

    const nuevoEstado = conforme ? 'cerrada' : 'recibida_con_obs';

    await prisma.$transaction(async (tx) => {
      await tx.recepciones.create({
        data: {
          tenant_id: session.tenantId,
          solicitud_id,
          receptor_id: session.userId,
          conforme,
          tipo_problema: tipo_problema ?? null,
          observaciones: observaciones ?? null,
        },
      });
      await tx.solicitudes.update({ where: { id: solicitud_id }, data: { estado: nuevoEstado } });
    });

    if (conforme) {
      await notificarPorRol(session.tenantId, 'tesoreria', 'Recepción confirmada', `${session.nombre} confirmó recepción de "${solicitud.titulo}"`, solicitud_id);
    } else {
      await notificarPorRol(session.tenantId, 'tesoreria', 'Recepción con problemas', `${session.nombre} reportó problema (${tipo_problema}) con "${solicitud.titulo}": ${observaciones}`, solicitud_id);
    }

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'confirmar_recepcion', entidad: 'recepcion', entidadId: solicitud_id, datosNuevos: { conforme, tipo_problema } });
    return Response.json({ message: conforme ? 'Recepción confirmada y solicitud cerrada' : 'Recepción registrada con observaciones' }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    console.error(error);
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
