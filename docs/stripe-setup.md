# Stripe setup para Box

Box cobra 152.000 ARS/mes con trial de 14 días sin tarjeta. Este doc describe
cómo dejar la cuenta de Stripe lista para que la app pueda cobrar.

## 1. Cuenta y activación de ARS

1. Crear cuenta en https://dashboard.stripe.com. Para test mode no hace falta
   KYC; para live mode Stripe requiere datos de la entidad (si operás desde
   Argentina puede que necesites cuenta fuera del país o un bridge tipo dLocal
   — ver "Riesgos conocidos" en el plan).
2. Habilitar ARS como currency de procesamiento en _Settings → Payments →
   Currencies_. Si no aparece ARS, Stripe te dice qué falta (usualmente es
   completar el perfil de la cuenta).

## 2. Producto + Price

1. _Products → Add product_:
   - **Name**: `Box Principal`
   - **Description**: `Plan único de Box, 14 días de trial.`
2. Bajo _Pricing_:
   - **Pricing model**: Standard.
   - **Price**: `152000.00 ARS` (monto completo, sin convertir a centavos —
     Stripe lo hace).
   - **Billing period**: Monthly / Recurring.
   - **Usage**: "Licensed".
3. Guardar. En la pestaña del price copiar el ID `price_...` → lo vas a usar
   como `STRIPE_PRICE_ID`.

> Si en el futuro cambiás el precio, **creá un price nuevo** — Stripe no
> permite editar el monto de uno existente. Actualizá `STRIPE_PRICE_ID` y
> seguirá vigente para tenants nuevos; los existentes quedan anclados al
> price viejo a menos que hagas un proration desde el customer portal.

## 3. API keys

En _Developers → API keys_:

- **Publishable key** (`pk_...`) — no la usamos (solo servidor).
- **Secret key** (`sk_...`) → `STRIPE_SECRET_KEY`.

Usá las keys de **Test mode** para dev y **Live mode** para prod. Nunca
mezcles.

## 4. Webhook

### Test mode (dev local)

Bajar el CLI:

```bash
curl -fsSL https://cli.stripe.com/install.sh | sh
# o: brew install stripe/stripe-cli/stripe
stripe login
```

En una terminal aparte mientras corre `npm run dev`:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

El CLI te imprime un `whsec_...` — ese va como `STRIPE_WEBHOOK_SECRET` en
`.env.local`. Dejalo corriendo todo el tiempo que estés testeando.

### Live mode (producción)

En _Developers → Webhooks → Add endpoint_:

- **URL**: `https://<tu-dominio>/api/stripe/webhook`
- **Events to send**: seleccionar estos 6:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `customer.subscription.trial_will_end`
  - `invoice.paid`
  - `invoice.payment_failed`

Después de crear, el dashboard te muestra el **Signing secret** (`whsec_...`)
— ese va como `STRIPE_WEBHOOK_SECRET` en Vercel.

## 5. Customer portal

En _Settings → Billing → Customer portal_ activar:

- **Invoices**: ver historial de facturas.
- **Update payment method**.
- **Cancel subscriptions** (con "Cancel at end of billing period" recomendado
  para que no pierdan acceso inmediatamente).
- **Update subscriptions**: desactivado (tenemos plan único).

Guardar. El botón "Administrar suscripción" en `/facturacion` abre este portal.

## 6. Variables de entorno

### `.env.local` (dev)

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...            # del `stripe listen`
STRIPE_PRICE_ID=price_...                  # del dashboard en test mode
```

### Vercel (prod)

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...            # del webhook en live mode
STRIPE_PRICE_ID=price_...                  # del dashboard en live mode
```

Sin las 3 vars, los endpoints `/api/stripe/*` devuelven 503 limpiamente y el
resto de la app sigue andando (útil para CI y dev sin cuenta).

## 7. Smoke test end-to-end

Con el CLI corriendo y las vars cargadas:

1. Registrar un tenant nuevo en `/registro` y completar el email. En la DB:
   `SELECT estado, trial_ends_at FROM suscripciones` → `trialing` con ~14 días.
2. Login, ir a `/facturacion`, click **Activar plan ahora** → redirige a
   Stripe Checkout.
3. Pagar con `4242 4242 4242 4242`, cualquier fecha futura, cualquier CVC.
4. Stripe redirige a `/facturacion?checkout=success`. En la terminal del CLI
   ves el evento `checkout.session.completed`.
5. En la DB: `estado='active'`, `stripe_customer_id` y `stripe_subscription_id`
   poblados.
6. En el dashboard de Stripe, cancelar la suscripción. El CLI reenvía
   `customer.subscription.deleted` → `estado='canceled'`.
7. Navegar al dashboard de Box → redirige a `/facturacion?reason=canceled`.

## 8. Tarjetas de test útiles

| Caso | Número |
|---|---|
| Éxito | `4242 4242 4242 4242` |
| Pago falla | `4000 0000 0000 9995` |
| Requiere 3DS | `4000 0025 0000 3155` |
| Tarjeta rechazada | `4000 0000 0000 0002` |

Cualquier fecha futura, cualquier CVC, cualquier ZIP. Lista completa:
https://docs.stripe.com/testing.

## 9. Qué hacer si algo se rompe

- **Webhook no actualiza la DB**: chequear que el `STRIPE_WEBHOOK_SECRET`
  coincida con el del CLI / endpoint. El CLI cambia el secret cada vez que
  hacés `stripe listen`.
- **`PLAN_LIMIT_*` al crear recursos**: el tenant está al tope del plan. Para
  levantar el cap hay que editar `planes` (via migración) y cambiar el price
  en Stripe si el precio cambia.
- **Tenant bloqueado sin acceso**: `UPDATE suscripciones SET estado='active',
  current_period_end = NOW() + INTERVAL '30 days' WHERE tenant_id = X`
  (solo como parche de emergencia — la fuente de verdad sigue siendo Stripe).
- **Re-enviar un evento**: en el dashboard, _Webhooks → tu endpoint → Events_
  hay un botón "Resend".
