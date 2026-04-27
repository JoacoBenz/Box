import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getPreApproval, isMpEnabled } from '@/lib/mercadopago';
import { attachMpPreapprovalToTenant } from '@/lib/subscription';
import { logApiError } from '@/lib/logger';

/**
 * GET /api/mercadopago/return
 *
 * Callback URL al que MP redirige al usuario después de autorizar la
 * suscripción. Recibe `preapproval_id` en la query string y lo asocia al
 * tenant del usuario logueado, dejando la fila `suscripciones` lista
 * inmediatamente — sin depender de que el webhook llegue primero ni de
 * que `external_reference` se haya preservado.
 *
 * Si el usuario llega sin sesión (cerró tab, sesión expiró), redirige a
 * `/login` y delegamos la sincronización al webhook (que va a recibir el
 * evento subscription_preapproval con el mismo preapproval_id).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const preapprovalId = url.searchParams.get('preapproval_id');
  const baseUrl = process.env.NEXTAUTH_URL ?? url.origin;

  // Si MP llamó sin preapproval_id (cancelación, error en su lado), volvemos
  // a la pantalla de facturación con un flag para mostrar mensaje.
  if (!preapprovalId) {
    return NextResponse.redirect(`${baseUrl}/perfil?tab=facturacion&checkout=cancelled`);
  }

  let session;
  try {
    session = await getServerSession();
  } catch {
    // Sin sesión, dejamos el linking al webhook.
    return NextResponse.redirect(
      `${baseUrl}/login?next=${encodeURIComponent('/perfil?tab=facturacion&checkout=success')}`,
    );
  }

  if (!isMpEnabled()) {
    return NextResponse.redirect(`${baseUrl}/perfil?tab=facturacion&checkout=success`);
  }

  try {
    const preapproval = getPreApproval()!;
    const sub = await preapproval.get({ id: preapprovalId });

    const status = sub.status ?? 'pending';
    if (status === 'authorized') {
      await attachMpPreapprovalToTenant({
        tenantId: session.tenantId,
        mpPreapprovalId: String(sub.id),
        payerEmail: sub.payer_email ?? null,
        currentPeriodStart: sub.date_created ? new Date(sub.date_created) : new Date(),
        currentPeriodEnd: sub.next_payment_date ? new Date(sub.next_payment_date) : null,
      });
    }
    // Cualquier otro estado (pending, cancelled): el webhook se encargará
    // cuando MP termine de procesar. No bloqueamos al usuario.
  } catch (err) {
    // Linking falló — no bloqueamos al usuario, el webhook puede arreglarlo.
    logApiError('/api/mercadopago/return', 'GET', err);
  }

  return NextResponse.redirect(`${baseUrl}/perfil?tab=facturacion&checkout=success`);
}
