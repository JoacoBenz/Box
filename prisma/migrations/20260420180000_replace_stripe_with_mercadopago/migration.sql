-- Billing provider swap: Stripe → Mercado Pago.
-- Stripe columns eran nullable y en producción no tenían valores reales
-- (intentos de checkout cacheados pero nunca completados).

-- suscripciones
DROP INDEX IF EXISTS "suscripciones_stripe_customer_id_key";
DROP INDEX IF EXISTS "suscripciones_stripe_subscription_id_key";

ALTER TABLE "suscripciones" DROP COLUMN IF EXISTS "stripe_customer_id";
ALTER TABLE "suscripciones" DROP COLUMN IF EXISTS "stripe_subscription_id";

ALTER TABLE "suscripciones" ADD COLUMN "mp_preapproval_id" VARCHAR(255);
ALTER TABLE "suscripciones" ADD COLUMN "mp_payer_email"    VARCHAR(255);

CREATE UNIQUE INDEX "suscripciones_mp_preapproval_id_key"
    ON "suscripciones"("mp_preapproval_id");

-- planes
ALTER TABLE "planes" DROP COLUMN IF EXISTS "stripe_price_id";
ALTER TABLE "planes" ADD COLUMN "mp_plan_id" VARCHAR(255);
