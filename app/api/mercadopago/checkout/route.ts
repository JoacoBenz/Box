import { withAuth } from '@/lib/api-handler';
import { isMpEnabled } from '@/lib/mercadopago';
import { getSubscriptionStatusFresh } from '@/lib/subscription';
import { prisma } from '@/lib/prisma';
import { logApiError } from '@/lib/logger';

/**
 * POST /api/mercadopago/checkout
 *
 * Crea una Preapproval de Mercado Pago para que el admin convierta el
 * trial en una suscripción recurrente. Devuelve { url } — el `init_point`
 * de MP donde el cliente autoriza la tarjeta.
 *
 * Usa `external_reference = tenant_id` para que el webhook pueda
 * asociar la preapproval con el tenant correcto.
 */
export const POST = withAuth(
  { roles: ['admin', 'director', 'super_admin'] },
  async (request, { session }) => {
    if (!isMpEnabled()) {
      return Response.json(
        { error: { code: 'MP_DISABLED', message: 'Mercado Pago no está configurado' } },
        { status: 503 },
      );
    }
    const planId = process.env.MP_PLAN_ID!;

    const subscription = await getSubscriptionStatusFresh(session.tenantId);
    if (!subscription) {
      return Response.json(
        {
          error: {
            code: 'NO_SUBSCRIPTION',
            message: 'No hay suscripción asociada a la organización',
          },
        },
        { status: 404 },
      );
    }
    if (subscription.estado === 'active') {
      return Response.json(
        { error: { code: 'ALREADY_ACTIVE', message: 'La suscripción ya está activa' } },
        { status: 400 },
      );
    }

    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: session.tenantId },
        select: { nombre: true, email_contacto: true },
      });

      const payerEmail = session.email ?? tenant?.email_contacto ?? '';
      if (!payerEmail) {
        return Response.json(
          { error: { code: 'NO_EMAIL', message: 'Falta email del pagador' } },
          { status: 400 },
        );
      }

      const checkoutUrl = new URL('https://www.mercadopago.com.ar/subscriptions/checkout');
      checkoutUrl.searchParams.set('preapproval_plan_id', planId);
      checkoutUrl.searchParams.set('external_reference', String(session.tenantId));
      checkoutUrl.searchParams.set('payer_email', payerEmail);

      return Response.json({ url: checkoutUrl.toString() });
    } catch (err: any) {
      logApiError('/api/mercadopago/checkout', 'POST', err);
      const detail = err?.message ?? err?.cause?.message ?? String(err);
      return Response.json(
        { error: { code: 'CHECKOUT_ERROR', message: 'No se pudo crear el checkout', detail } },
        { status: 500 },
      );
    }
  },
);
