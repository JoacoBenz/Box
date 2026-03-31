import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma } from '@/lib/prisma';
import { verificarRol } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';
import { z } from 'zod';

const programarPagoSchema = z.object({
  dia_pago_programado: z.string().refine((val) => !isNaN(Date.parse(val)), 'Fecha inválida'),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['compras'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo el sector Compras puede programar pagos' } }, { status: 403 });
    }

    const { id } = await params;
    const solicitudId = parseInt(id);
    const db = tenantPrisma(session.tenantId);

    const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
    if (!solicitud) return Response.json({ error: { code: 'NOT_FOUND', message: 'No encontrada' } }, { status: 404 });
    if (solicitud.estado !== 'en_compras') {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Solo se pueden programar pagos de solicitudes en compras' } }, { status: 400 });
    }

    const body = await request.json();
    const result = programarPagoSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } }, { status: 400 });
    }

    const diaPago = new Date(result.data.dia_pago_programado);

    await db.solicitudes.update({
      where: { id: solicitudId },
      data: {
        estado: 'pago_programado',
        dia_pago_programado: diaPago,
      },
    });

    const fechaStr = diaPago.toLocaleDateString('es-AR');
    await crearNotificacion({
      tenantId: session.tenantId,
      destinatarioId: solicitud.solicitante_id,
      tipo: 'pago_programado',
      titulo: 'Pago programado',
      mensaje: `El pago de "${solicitud.titulo}" fue programado para el ${fechaStr}`,
      solicitudId,
    });
    await notificarPorRol(session.tenantId, 'tesoreria', 'Pago programado para ejecutar', `Pago de "${solicitud.titulo}" programado para el ${fechaStr}`, solicitudId);

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'programar_pago', entidad: 'solicitud', entidadId: solicitudId, datosNuevos: { dia_pago_programado: result.data.dia_pago_programado } });
    return Response.json({ message: 'Pago programado' });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
