import { withAuth } from '@/lib/api-handler';
import { getSubscriptionStatusFresh } from '@/lib/subscription';
import { getPlanUsage } from '@/lib/plan-limits';

/**
 * GET /api/stripe/subscription
 *
 * Returns current subscription snapshot + plan usage (areas, CCs, role counts)
 * for the /facturacion page.
 */
export const GET = withAuth({}, async (_request, { session }) => {
  const subscription = await getSubscriptionStatusFresh(session.tenantId);
  if (!subscription) {
    return Response.json(
      { error: { code: 'NO_SUBSCRIPTION', message: 'Sin suscripción' } },
      { status: 404 },
    );
  }

  const usage = await getPlanUsage(session.tenantId);
  return Response.json({ subscription, usage });
});
