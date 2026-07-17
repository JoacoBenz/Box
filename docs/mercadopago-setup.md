# Mercado Pago setup para Box

Box cobra 110.000 ARS/mes con Preapproval de Mercado Pago (recurrencia
automática), con trial de 14 días sin tarjeta.

## TL;DR — orden de deploy a producción

Si ya hay tenants existentes:

```
1. Backup de la DB (Supabase → Backups → Download)
2. npx prisma migrate deploy                       # drop Stripe cols + add MP cols
3. npx prisma db seed                              # idempotente
4. (opcional) backfill — los tenants del trial siguen en trialing sin tocar MP
5. Crear Preapproval Plan en MP dashboard (una vez)
6. Configurar webhook en MP dashboard → tu dominio + signing secret
7. Setear MP_ACCESS_TOKEN / MP_WEBHOOK_SECRET / MP_PLAN_ID en Vercel
8. Deploy
9. Smoke test: registrar tenant → activar plan → pagar con tarjeta de test
```

## 1. Cuenta y credenciales

1. Crear cuenta vendedor en https://www.mercadopago.com.ar (o el país que
   corresponda). Para producción requiere verificación de identidad +
   datos bancarios.
2. En **"Tus integraciones" → Crear aplicación** (tipo "Pagos online").
3. En la pestaña **Credenciales**:
   - **Test** (desarrollo): copiá `TEST-...` access token.
   - **Producción** (live): aparece después de verificar la cuenta.

**Nunca uses credenciales de producción en dev.**

## 2. Preapproval Plan

Necesitamos un "plan de suscripción" creado en MP una sola vez. Box usa
ese ID como `MP_PLAN_ID` para todas las preapprovals que genera.

### Opción A — Desde el dashboard de MP (recomendado)

En **"Tus integraciones" → tu app → Suscripciones**:

1. **+ Crear plan**.
2. Datos:
   - **Nombre**: `Box Principal`
   - **Descripción**: `Sistema de gestión de compras — plan mensual`
   - **Moneda**: ARS
   - **Monto**: `110000`
   - **Frecuencia**: `1 mes`
   - **Free trial**: 14 días (o dejarlo sin trial, ya lo manejamos en DB).
3. Guardar → copiá el **ID del plan** (`2c9380848...`) → va como `MP_PLAN_ID`.

### Opción B — Por API

```bash
curl -X POST https://api.mercadopago.com/preapproval_plan \
  -H "Authorization: Bearer $MP_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Box Principal",
    "auto_recurring": {
      "frequency": 1,
      "frequency_type": "months",
      "transaction_amount": 110000,
      "currency_id": "ARS"
    },
    "back_url": "https://box.bexovar.com.ar/api/mercadopago/return"
  }'
```

La respuesta incluye el `id` → copialo.

## 3. Webhook

### En el dashboard de MP

**"Tus integraciones" → tu app → Webhooks**:

1. **Configurar notificaciones**.
2. **URL**: `https://<tu-dominio>/api/mercadopago/webhook`
3. **Eventos**: marcá **Suscripciones (preapproval)**. Los otros (payment,
   plan) los ignoramos, pero seleccionarlos no rompe nada.
4. Guardar.
5. En la sección **Firma secreta**, copiá el valor → va como `MP_WEBHOOK_SECRET`.

### Para dev local

MP no tiene CLI como Stripe. Dos opciones:

- **ngrok / cloudflared**: exponer `localhost:3000` con una URL pública
  y configurar esa URL como webhook en test mode.
  ```bash
  # con cloudflared
  cloudflared tunnel --url http://localhost:3000
  # configurar el webhook en MP con la URL https:// resultante
  ```
- **Test en Vercel preview**: pushear a branch `claude/mercadopago-migration`,
  Vercel genera preview deploy con URL, configurar el webhook ahí.

## 4. Variables de entorno

### `.env.local` (dev)

```
MP_ACCESS_TOKEN=TEST-xxx-...
MP_WEBHOOK_SECRET=whsec_mp_...                 # del webhook en test mode
MP_PLAN_ID=2c9380848...                        # del plan en test mode
```

### Vercel (prod)

```
MP_ACCESS_TOKEN=APP_USR-xxx-...                # credencial de producción
MP_WEBHOOK_SECRET=whsec_mp_...                 # del webhook en live mode
MP_PLAN_ID=2c9380848...                        # del plan en live mode
```

Sin las 3, los endpoints `/api/mercadopago/*` devuelven 503 y el resto
de la app sigue funcionando (útil para CI y dev sin cuenta).

## 5. Smoke test end-to-end

Con el webhook apuntando al dominio correcto y env cargadas:

1. Registrar tenant nuevo en `/registro` y verificar el email. En DB:
   `estado='trialing'`, `mp_preapproval_id IS NULL`.
2. Login → `/perfil?tab=facturacion` → **Activar plan ahora**.
3. Redirige a checkout de MP (init_point). Pagar con **tarjeta de test** MP:
   - **Número**: `5031 7557 3453 0604` (Mastercard aprobada)
   - **Fecha**: cualquier futura, ej `11/30`
   - **CVV**: `123`
   - **Documento**: `12345678` (8 dígitos)
   - **Nombre del titular**: `APRO` (aprueba automáticamente)
4. MP redirige a `/perfil?tab=facturacion&checkout=success`.
5. Webhook llega con `type=subscription_preapproval` + `status=authorized`.
6. En DB: `estado='active'`, `mp_preapproval_id='...'`, `mp_payer_email='...'`.
7. Desde `/perfil?tab=facturacion` → **Cancelar suscripción** → confirmar.
8. En DB: `estado='canceled'`, `canceled_at` seteado.
9. Navegar a `/solicitudes` → redirect a `/perfil?tab=facturacion&reason=canceled`.

## 6. Tarjetas de test de MP

| Nombre titular | Resultado |
|---|---|
| `APRO` | Aprobada |
| `OTHE` | Rechazada por error general |
| `CONT` | Pendiente |
| `CALL` | Rechazada con validación para llamar |
| `FUND` | Rechazada por importe insuficiente |
| `SECU` | Rechazada por código de seguridad |

Números completos en: https://www.mercadopago.com.ar/developers/es/docs/checkout-api/additional-content/test-cards

## 7. Diferencias con Stripe

- **No hay customer portal**. La UI de "Cancelar suscripción" está en
  nuestra app (`/api/mercadopago/cancelar`).
- **Webhook format**: MP manda solo `{ type, data.id }` — hay que pegarle
  al API para traer el objeto completo.
- **Firma**: HMAC-SHA256 sobre `id:<dataId>;request-id:<reqId>;ts:<ts>;`.
- **Trial**: el status `pending` cubre el período antes del primer cobro;
  nosotros usamos nuestro propio campo `trial_ends_at` + estado
  `trialing` porque MP no distingue "trial" vs "pending" en Preapproval
  de la misma forma que Stripe.

## 8. Troubleshooting

- **Webhook no actualiza DB**: verificar que `MP_WEBHOOK_SECRET` del
  dashboard = el de Vercel. MP regenera el secret si lo pedís.
- **"La suscripción todavía no está activada en MP"** al cancelar: el
  usuario nunca autorizó la preapproval (sigue en trial). No tiene nada
  que cancelar.
- **Tenant bloqueado con sub activa**: probablemente past_due pasó el
  grace window. `UPDATE suscripciones SET estado='active', current_period_end = NOW() + INTERVAL '30 days' WHERE tenant_id = X`.
- **Reintentar webhook**: MP no tiene botón como Stripe. Si perdiste un
  evento, actualizar manualmente o consultar el preapproval por API:
  ```bash
  curl https://api.mercadopago.com/preapproval/<ID> \
    -H "Authorization: Bearer $MP_ACCESS_TOKEN"
  ```
