import { redirect } from 'next/navigation';
import { billingUrl } from '@/lib/billing-links';

/**
 * Legacy route — facturación ahora vive embebida como tab dentro de /perfil.
 * Este redirect se mantiene para que sigan funcionando:
 *  - los deep-links del SubscriptionBanner (`/facturacion`)
 *  - los `return_url` / `cancel_url` que Stripe Checkout fue generando
 *    antes de este cambio (estaban cacheados con `/facturacion?checkout=success`)
 *  - el redirect del proxy cuando la suscripción está cancelada/impaga
 */

/** Whitelist de params que vale la pena propagar. Anything else se descarta
 *  para evitar reflejar input arbitrario en la URL final. */
const FORWARDED_PARAMS = new Set(['checkout', 'reason']);

export default async function FacturacionRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const forwarded: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!FORWARDED_PARAMS.has(key)) continue;
    // Arrays (?key=a&key=b) tomamos el primer valor.
    const v = Array.isArray(value) ? value[0] : value;
    if (typeof v === 'string' && v.length > 0) forwarded[key] = v;
  }
  redirect(billingUrl(forwarded));
}
