import { withTenant } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';

export const PATCH = withTenant(async (_request, { session }) => {
  await prisma.notificaciones.updateMany({
    where: { tenant_id: session.tenantId, usuario_destino_id: session.userId, leida: false },
    data: { leida: true },
  });
  return Response.json({ message: 'Todas las notificaciones marcadas como leídas' });
});
