import { redirect } from 'next/navigation';

/**
 * Legacy route — facturación ahora vive embebida como tab dentro de /perfil.
 * Este redirect se mantiene para que sigan funcionando:
 *  - los deep-links del SubscriptionBanner (`/facturacion`)
 *  - los `return_url` / `cancel_url` que Stripe Checkout fue generando
 *    antes de este cambio (estaban cacheados con `/facturacion?checkout=success`)
 *  - el redirect del proxy cuando la suscripción está cancelada/impaga
 */
export default async function FacturacionRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  qs.set('tab', 'facturacion');
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') qs.set(key, value);
  }
  redirect(`/perfil?${qs.toString()}`);
}
