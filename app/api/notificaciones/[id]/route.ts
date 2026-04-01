import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    const { id } = await params;
    const notifId = parseInt(id);
    const db = tenantPrisma(session.tenantId);

    const notif = await db.notificaciones.findFirst({ where: { id: notifId, usuario_destino_id: session.userId } });
    if (!notif) return Response.json({ error: { code: 'NOT_FOUND', message: 'Notificación no encontrada' } }, { status: 404 });

    await db.notificaciones.update({ where: { id: notifId }, data: { leida: true } });
    return Response.json({ message: 'Notificación marcada como leída' });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
