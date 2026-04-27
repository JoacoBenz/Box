import { NextRequest } from 'next/server';
import { getPreApproval, verifyMpSignature } from '@/lib/mercadopago';
import {
  attachMpPreapprovalToTenant,
  markSubscriptionCanceled,
  syncSubscriptionFromMp,
} from '@/lib/subscription';
import { logApiError } from '@/lib/logger';

/**
 * Mercado Pago webhook endpoint.
 *
 * MP no manda el objeto completo en el webhook — solo un notification
 * con `type` (topic) + `data.id`. Hay que pegarle al API para traer los
 * detalles del recurso (preapproval en nuestro caso).
 *
 * Verifica firma HMAC-SHA256 sobre `id:{dataId};request-id:{reqId};ts:{ts};`
 * con MP_WEBHOOK_SECRET. Sin secret válido devuelve 400.
 */

// Necesitamos el body raw para la firma.
export const dynamic = 'force-dynamic';

type MpWebhookBody = {
  action?: string; // e.g. "updated", "created"
  type?: string; // e.g. "subscription_preapproval", "payment"
  data?: { id?: string };
  user_id?: string;
  api_version?: string;
  live_mode?: boolean;
};

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.MP_WEBHOOK_SECRET;
  if (!webhookSecret || !process.env.MP_ACCESS_TOKEN) {
    return Response.json(
      { error: { code: 'MP_DISABLED', message: 'Mercado Pago no está configurado' } },
      { status: 503 },
    );
  }

  const signature = request.headers.get('x-signature');
  const requestId = request.headers.get('x-request-id');
  const rawBody = await request.text();

  let body: MpWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } },
      { status: 400 },
    );
  }

  const dataId = body.data?.id ?? null;

  const valid = verifyMpSignature({
    signatureHeader: signature,
    requestIdHeader: requestId,
    dataId,
    secret: webhookSecret,
  });
  if (!valid) {
    logApiError('/api/mercadopago/webhook', 'POST', new Error('invalid MP signature'));
    return Response.json(
      { error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } },
      { status: 400 },
    );
  }

  try {
    await handleEvent(body);
    return Response.json({ received: true });
  } catch (err) {
    logApiError('/api/mercadopago/webhook', 'POST', err);
    // Devolvemos 500 así MP reintenta.
    return Response.json(
      { error: { code: 'HANDLER_ERROR', message: 'Error processing event' } },
      { status: 500 },
    );
  }
}

async function handleEvent(body: MpWebhookBody): Promise<void> {
  const topic = body.type;
  const dataId = body.data?.id;
  if (!dataId) return;

  // Solo nos importan notificaciones de preapproval (subscription).
  // MP también manda `payment` notifications que el propio preapproval
  // integra en su ciclo, pero no agregan información que no veamos ya
  // via `subscription_preapproval` events. Ignoramos payment directamente.
  if (topic !== 'subscription_preapproval') return;

  const preapproval = getPreApproval();
  if (!preapproval) return;

  let sub: Awaited<ReturnType<typeof preapproval.get>>;
  try {
    sub = await preapproval.get({ id: dataId });
  } catch (err: any) {
    // El "Enviar prueba" del dashboard de MP manda data.id="123456" — un
    // string que no existe. preapproval.get() tira 404 y caería como 500
    // global, gatillando reintentos. No hay nada que sincronizar; salimos OK.
    if (err?.status === 404 || err?.cause?.status === 404) {
      logApiError(
        '/api/mercadopago/webhook',
        'POST',
        new Error(`preapproval ${dataId} not found (likely synthetic test event)`),
      );
      return;
    }
    throw err;
  }
  if (!sub) return;

  const status = sub.status ?? 'pending';
  const externalReference = sub.external_reference;
  const tenantId = externalReference ? Number(externalReference) : NaN;

  const nextPaymentDate = sub.next_payment_date ? new Date(sub.next_payment_date) : null;
  const canceledAt = status === 'cancelled' ? new Date() : null;

  // Primera vez que vemos esta preapproval (recién autorizada): atamos al
  // tenant usando external_reference. El segundo y los siguientes updates
  // caen por el mp_preapproval_id en syncSubscriptionFromMp.
  if (status === 'authorized' && Number.isFinite(tenantId)) {
    await attachMpPreapprovalToTenant({
      tenantId,
      mpPreapprovalId: String(sub.id),
      payerEmail: sub.payer_email ?? null,
      currentPeriodStart: sub.date_created ? new Date(sub.date_created) : null,
      currentPeriodEnd: nextPaymentDate,
    });
    return;
  }

  if (status === 'cancelled') {
    await markSubscriptionCanceled(String(sub.id));
    return;
  }

  await syncSubscriptionFromMp({
    mpPreapprovalId: String(sub.id),
    status,
    nextPaymentDate,
    canceledAt,
  });
}
