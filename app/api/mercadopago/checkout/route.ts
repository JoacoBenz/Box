import { withAuth } from '@/lib/api-handler';
import { getPreApproval, isMpEnabled } from '@/lib/mercadopago';
import { getSubscriptionStatusFresh } from '@/lib/subscription';
import { prisma } from '@/lib/prisma';
import { logApiError } from '@/lib/logger';

/**
 * POST /api/mercadopago/checkout
 *
 * Crea una Preapproval de Mercado Pago via API y devuelve el `init_point`
 * donde el cliente autoriza la tarjeta.
 *
 * Decisiones de diseño:
 * 1. Creamos la preapproval server-side con `external_reference = tenant_id`
 *    para que el webhook pueda atar el evento al tenant.
 * 2. Usamos `auto_recurring` (frecuencia + monto + currency) en vez de
 *    `preapproval_plan_id`. MP exige `card_token_id` para crear preapprovals
 *    plan-based via API (autoriza inmediatamente). Con `auto_recurring` +
 *    `status: 'pending'` MP nos da un init_point para que el usuario autorice
 *    en su pantalla, sin tener que tokenizar la tarjeta del lado nuestro.
 * 3. Los términos del plan (monto, frecuencia) salen de la tabla `planes`
 *    para no duplicar lógica.
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
      const [tenant, plan] = await Promise.all([
        prisma.tenants.findUnique({
          where: { id: session.tenantId },
          select: { nombre: true },
        }),
        prisma.planes.findUnique({
          where: { id: subscription.planId },
          select: { precio_ars: true },
        }),
      ]);

      if (!plan?.precio_ars) {
        return Response.json(
          { error: { code: 'NO_PLAN', message: 'No se encontró el plan' } },
          { status: 500 },
        );
      }

      const preapproval = getPreApproval()!;
      const baseUrl = process.env.NEXTAUTH_URL ?? new URL(request.url).origin;

      const body: Parameters<typeof preapproval.create>[0]['body'] = {
        external_reference: String(session.tenantId),
        reason: `Box GdC - ${tenant?.nombre ?? `Tenant ${session.tenantId}`}`,
        back_url: `${baseUrl}/perfil?tab=facturacion&checkout=success`,
        status: 'pending',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: plan.precio_ars,
          currency_id: 'ARS',
        },
      };

      // Sandbox: MP exige que payer y collector sean ambos test o ambos reales.
      // Si MP_ACCESS_TOKEN es del seller test user, el payer_email tiene que
      // matchear un buyer test user. Usamos MP_TEST_BUYER_EMAIL como puente.
      // Producción: NO pasamos payer_email — MP le pide login al usuario que
      // entre al init_point y toma el email de la cuenta con la que autoriza.
      // Esto permite que admin de la app ≠ dueño de la cuenta MP que paga.
      if (process.env.MP_TEST_BUYER_EMAIL) {
        body.payer_email = process.env.MP_TEST_BUYER_EMAIL;
      }

      const created = await preapproval.create({ body });

      if (!created.init_point) {
        return Response.json(
          { error: { code: 'CHECKOUT_ERROR', message: 'MP no devolvió init_point' } },
          { status: 500 },
        );
      }

      return Response.json({ url: created.init_point });
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
