import { withTenant } from '@/lib/api-handler';

export const GET = withTenant(async (request, { session, db }) => {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const soloNoLeidas = searchParams.get('soloNoLeidas') === 'true';

  const where: any = { usuario_destino_id: session.userId };
  if (soloNoLeidas) where.leida = false;

  const notificaciones = await db.notificaciones.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  return Response.json(notificaciones);
});
