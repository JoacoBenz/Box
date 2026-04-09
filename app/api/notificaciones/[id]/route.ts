import { withTenant, parseId } from '@/lib/api-handler';

export const PATCH = withTenant(async (_request, { session, db }, params) => {
  const notifId = parseId(params.id);
  if (!notifId) return Response.json({ error: { code: 'BAD_REQUEST', message: 'ID inválido' } }, { status: 400 });

  const notif = await db.notificaciones.findFirst({ where: { id: notifId, usuario_destino_id: session.userId } });
  if (!notif) return Response.json({ error: { code: 'NOT_FOUND', message: 'Notificación no encontrada' } }, { status: 404 });

  await db.notificaciones.update({ where: { id: notifId }, data: { leida: true } });
  return Response.json({ message: 'Notificación marcada como leída' });
});
