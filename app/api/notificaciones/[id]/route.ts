import { withTenant } from '@/lib/api-handler';

export const PATCH = withTenant(async (_request, { session, db }, params) => {
  const notifId = parseInt(params.id);

  const notif = await db.notificaciones.findFirst({ where: { id: notifId, usuario_destino_id: session.userId } });
  if (!notif) return Response.json({ error: { code: 'NOT_FOUND', message: 'Notificación no encontrada' } }, { status: 404 });

  await db.notificaciones.update({ where: { id: notifId }, data: { leida: true } });
  return Response.json({ message: 'Notificación marcada como leída' });
});
