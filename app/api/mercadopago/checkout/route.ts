import { withAuth } from '@/lib/api-handler';
import { isMpEnabled } from '@/lib/mercadopago';
import { getSubscriptionStatusFresh } from '@/lib/subscription';
import { prisma } from '@/lib/prisma';
import { logApiError } from '@/lib/logger';

/**
 * POST /api/mercadopago/checkout
 *
 * Genera la URL hosted de MP para que el admin autorice la suscripción.
 *
 * Diseño:
 * - Usamos el flujo `subscriptions/checkout?preapproval_plan_id=...` (URL).
 *   La alternativa (crear preapproval via API) MP la rechazó con 500 sin
 *   contexto y con `card_token_id is required` cuando intentábamos pendiente.
 * - El URL flow descarta `external_reference` aunque lo pasemos en query
 *   string. Para cubrir eso, el `back_url` apunta a `/api/mercadopago/return`,
 *   un endpoint server-side que recibe `preapproval_id` cuando MP redirige al
 *   usuario, lo asocia al tenant del usuario (vía sesión) y deja la fila lista
 *   en `suscripciones`. El webhook se encarga de eventos posteriores (cancel,
 *   payment_failed, etc.) usando ese `mp_preapproval_id` ya guardado.
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
    const planId = process.env.MP_PLAN_ID;
    if (!planId) {
      return Response.json(
        { error: { code: 'MP_DISABLED', message: 'Falta MP_PLAN_ID' } },
        { status: 503 },
      );
    }

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
        select: { email_contacto: true },
      });

      const payerEmail =
        process.env.MP_TEST_BUYER_EMAIL ?? session.email ?? tenant?.email_contacto ?? '';
      if (!payerEmail) {
        return Response.json(
          { error: { code: 'NO_EMAIL', message: 'Falta email del pagador' } },
          { status: 400 },
        );
      }

      const baseUrl = process.env.NEXTAUTH_URL ?? new URL(request.url).origin;
      const checkoutUrl = new URL('https://www.mercadopago.com.ar/subscriptions/checkout');
      checkoutUrl.searchParams.set('preapproval_plan_id', planId);
      checkoutUrl.searchParams.set('external_reference', String(session.tenantId));
      checkoutUrl.searchParams.set('payer_email', payerEmail);
      checkoutUrl.searchParams.set('back_url', `${baseUrl}/api/mercadopago/return`);

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
