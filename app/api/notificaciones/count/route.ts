import { getServerSession } from '@/lib/auth';
import { tenantPrisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession();
    const db = tenantPrisma(session.tenantId);
    const count = await db.notificaciones.count({ where: { usuario_destino_id: session.userId, leida: false } });
    return Response.json({ count });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
