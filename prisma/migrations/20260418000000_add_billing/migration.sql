-- Billing: plans and subscriptions for multi-tenant SaaS pricing.

CREATE TABLE "planes" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "precio_ars" INTEGER NOT NULL,
    "trial_dias" INTEGER NOT NULL DEFAULT 14,
    "limite_areas" INTEGER NOT NULL DEFAULT 3,
    "limite_cc_por_area" INTEGER NOT NULL DEFAULT 2,
    "limite_responsable_area" INTEGER NOT NULL DEFAULT 1,
    "limite_director" INTEGER NOT NULL DEFAULT 1,
    "limite_tesoreria" INTEGER NOT NULL DEFAULT 1,
    "limite_admin" INTEGER NOT NULL DEFAULT 1,
    "limite_compras" INTEGER NOT NULL DEFAULT 1,
    "stripe_price_id" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "planes_nombre_key" ON "planes"("nombre");

CREATE TABLE "suscripciones" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "stripe_customer_id" VARCHAR(255),
    "stripe_subscription_id" VARCHAR(255),
    "trial_starts_at" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "suscripciones_tenant_id_key" ON "suscripciones"("tenant_id");
CREATE UNIQUE INDEX "suscripciones_stripe_customer_id_key" ON "suscripciones"("stripe_customer_id");
CREATE UNIQUE INDEX "suscripciones_stripe_subscription_id_key" ON "suscripciones"("stripe_subscription_id");
CREATE INDEX "suscripciones_estado_idx" ON "suscripciones"("estado");
CREATE INDEX "suscripciones_trial_ends_at_idx" ON "suscripciones"("trial_ends_at");
CREATE INDEX "suscripciones_current_period_end_idx" ON "suscripciones"("current_period_end");

ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "suscripciones" ADD CONSTRAINT "suscripciones_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "planes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the single default plan so tenant creation always has a plan to subscribe to.
INSERT INTO "planes" ("nombre", "precio_ars", "trial_dias", "limite_areas", "limite_cc_por_area", "limite_responsable_area", "limite_director", "limite_tesoreria", "limite_admin", "limite_compras", "updated_at")
VALUES ('box-principal', 152000, 14, 3, 2, 1, 1, 1, 1, 1, CURRENT_TIMESTAMP);
