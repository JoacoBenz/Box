import { withTenant } from '@/lib/api-handler';

export const GET = withTenant(async (_request, { session, db }) => {
  const count = await db.notificaciones.count({
    where: { usuario_destino_id: session.userId, leida: false },
  });
  return Response.json({ count });
});
