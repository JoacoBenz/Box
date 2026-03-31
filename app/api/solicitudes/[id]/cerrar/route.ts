import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma } from '@/lib/prisma';
import { verificarRol } from '@/lib/permissions';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { crearNotificacion } from '@/lib/notifications';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['tesoreria', 'admin'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Sin permiso' } }, { status: 403 });
    }

    const { id } = await params;
    const solicitudId = parseInt(id);
    const db = tenantPrisma(session.tenantId);

    const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
    if (!solicitud) return Response.json({ error: { code: 'NOT_FOUND', message: 'No encontrada' } }, { status: 404 });
    if (solicitud.estado !== 'recibida_con_obs') {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Solo se pueden cerrar solicitudes con observaciones de recepción' } }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const resolucion = body?.resolucion ?? 'Resuelto';

    await db.solicitudes.update({ where: { id: solicitudId }, data: { estado: 'cerrada' } });
    await crearNotificacion({ tenantId: session.tenantId, destinatarioId: solicitud.solicitante_id, tipo: 'solicitud_cerrada', titulo: 'Tu solicitud fue cerrada', mensaje: `Resolución: ${resolucion}`, solicitudId });

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'cerrar_solicitud', entidad: 'solicitud', entidadId: solicitudId, datosNuevos: { resolucion }, ipAddress: getClientIp(request) });
    return Response.json({ message: 'Solicitud cerrada' });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
