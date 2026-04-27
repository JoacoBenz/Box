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
          select: { nombre: true, email_contacto: true },
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

      // payer_email es REQUIRED por la API de MP, no es opcional como dice el
      // SDK type. En producción MP lo trata como hint: pre-llena el email en
      // su pantalla de login, pero el usuario puede entrar con OTRA cuenta MP
      // y autorizar con esa — el `payer` final es quien autoriza, no este hint.
      // En sandbox MP cruza `payer_email` con sus test users y exige match
      // test/real con el collector — por eso MP_TEST_BUYER_EMAIL existe.
      const payerEmail =
        process.env.MP_TEST_BUYER_EMAIL ?? session.email ?? tenant?.email_contacto ?? '';
      if (!payerEmail) {
        return Response.json(
          { error: { code: 'NO_EMAIL', message: 'Falta email del pagador' } },
          { status: 400 },
        );
      }

      const preapproval = getPreApproval()!;
      const baseUrl = process.env.NEXTAUTH_URL ?? new URL(request.url).origin;

      const body: Parameters<typeof preapproval.create>[0]['body'] = {
        external_reference: String(session.tenantId),
        payer_email: payerEmail,
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

      const created = await preapproval.create({ body });

      if (!created.init_point) {
        return Response.json(
          { error: { code: 'CHECKOUT_ERROR', message: 'MP no devolvió init_point' } },
          { status: 500 },
        );
      }

      return Response.json({ url: created.init_point });
    } catch (err: any) {
      // El SDK de MP arroja `await response.json()` directo, así que `err` es
      // el body completo que devolvió MP. Lo serializamos entero al log y
      // exponemos los campos típicos al cliente para poder debuggear.
      logApiError('/api/mercadopago/checkout', 'POST', err);
      const mpStatus = err?.status ?? err?.api_response?.status;
      const detail =
        err?.message ??
        err?.error ??
        err?.cause?.[0]?.description ??
        err?.cause?.message ??
        (typeof err === 'object' ? JSON.stringify(err).slice(0, 300) : String(err));
      return Response.json(
        {
          error: {
            code: 'CHECKOUT_ERROR',
            message: 'No se pudo crear el checkout',
            detail,
            mpStatus,
          },
        },
        { status: 500 },
      );
    }
  },
);
