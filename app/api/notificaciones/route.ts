import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const { searchParams } = request.nextUrl;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const soloNoLeidas = searchParams.get('soloNoLeidas') === 'true';

    const db = tenantPrisma(session.tenantId);
    const where: any = { usuario_destino_id: session.userId };
    if (soloNoLeidas) where.leida = false;

    const notificaciones = await db.notificaciones.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return Response.json(notificaciones);
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
