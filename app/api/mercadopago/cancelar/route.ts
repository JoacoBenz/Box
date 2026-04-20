import { withAuth } from '@/lib/api-handler';
import { getPreApproval, isMpEnabled } from '@/lib/mercadopago';
import { getSubscriptionStatusFresh } from '@/lib/subscription';
import { prisma } from '@/lib/prisma';
import { invalidateTenantCache } from '@/lib/cache';
import { logApiError } from '@/lib/logger';

/**
 * POST /api/mercadopago/cancelar
 *
 * Mercado Pago no tiene "customer portal" como Stripe — la cancelación se
 * hace desde nuestra app. Actualiza la preapproval a status=cancelled
 * (para que MP deje de cobrar) y marca canceled en nuestra DB.
 *
 * El webhook posterior confirma la sincronía; el update local acá evita
 * que el usuario vea "Activa" si el webhook tarda.
 */
export const POST = withAuth(
  { roles: ['admin', 'director', 'super_admin'] },
  async (_request, { session }) => {
    if (!isMpEnabled()) {
      return Response.json(
        { error: { code: 'MP_DISABLED', message: 'Mercado Pago no está configurado' } },
        { status: 503 },
      );
    }
    const preapproval = getPreApproval()!;

    const subscription = await getSubscriptionStatusFresh(session.tenantId);
    if (!subscription?.mpPreapprovalId) {
      return Response.json(
        {
          error: {
            code: 'NO_PREAPPROVAL',
            message: 'La suscripción todavía no está activada en MP',
          },
        },
        { status: 400 },
      );
    }
    if (subscription.estado === 'canceled') {
      return Response.json(
        { error: { code: 'ALREADY_CANCELED', message: 'La suscripción ya está cancelada' } },
        { status: 400 },
      );
    }

    try {
      await preapproval.update({
        id: subscription.mpPreapprovalId,
        body: { status: 'cancelled' },
      });

      await prisma.suscripciones.update({
        where: { tenant_id: session.tenantId },
        data: { estado: 'canceled', canceled_at: new Date() },
      });
      invalidateTenantCache(session.tenantId);

      return Response.json({ ok: true });
    } catch (err) {
      logApiError('/api/mercadopago/cancelar', 'POST', err);
      return Response.json(
        { error: { code: 'CANCEL_ERROR', message: 'No se pudo cancelar la suscripción' } },
        { status: 500 },
      );
    }
  },
);
