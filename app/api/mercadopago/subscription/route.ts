import { withAuth } from '@/lib/api-handler';
import { getSubscriptionStatusFresh } from '@/lib/subscription';
import { getPlanUsage } from '@/lib/plan-limits';

/**
 * GET /api/mercadopago/subscription
 *
 * Devuelve subscription + plan usage para la UI de /perfil?tab=facturacion.
 * Gated a roles que toman decisiones de billing.
 */
export const GET = withAuth(
  { roles: ['admin', 'director', 'super_admin'] },
  async (_request, { session }) => {
    const subscription = await getSubscriptionStatusFresh(session.tenantId);
    if (!subscription) {
      return Response.json(
        { error: { code: 'NO_SUBSCRIPTION', message: 'Sin suscripción' } },
        { status: 404 },
      );
    }

    const usage = await getPlanUsage(session.tenantId);
    return Response.json({ subscription, usage });
  },
);
