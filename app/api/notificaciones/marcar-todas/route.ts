import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH() {
  try {
    const session = await getServerSession();
    await prisma.notificaciones.updateMany({
      where: { tenant_id: session.tenantId, usuario_destino_id: session.userId, leida: false },
      data: { leida: true },
    });
    return Response.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
