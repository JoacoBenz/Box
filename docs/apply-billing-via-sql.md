# Aplicar billing via Supabase SQL Editor

Alternativa a correr los scripts locales. Pegá estos 3 bloques **en orden**
desde _Supabase Dashboard → SQL Editor → New query_.

## 1. Crear tablas + seed del plan (la migración)

```sql
-- Archivo fuente: prisma/migrations/20260418000000_add_billing/migration.sql
-- Si lo corrés desde el SQL editor NO queda registrado en _prisma_migrations.
-- Después lo arreglamos con el bloque 4 más abajo.

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

ALTER TABLE "suscripciones"
  ADD CONSTRAINT "suscripciones_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "suscripciones"
  ADD CONSTRAINT "suscripciones_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "planes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "planes"
  ("nombre", "precio_ars", "trial_dias", "limite_areas", "limite_cc_por_area",
   "limite_responsable_area", "limite_director", "limite_tesoreria",
   "limite_admin", "limite_compras", "updated_at")
VALUES ('box-principal', 152000, 14, 3, 2, 1, 1, 1, 1, 1, CURRENT_TIMESTAMP);
```

Ejecutar. Si sale "Success", pasás al bloque 2.

## 2. Dry-run del backfill (readonly, no escribe)

```sql
-- Lista los tenants que van a recibir un trial de 30 días
SELECT
    t.id,
    t.slug,
    t.nombre,
    t.estado,
    t.desactivado,
    (NOW() + INTERVAL '30 days')::timestamp AS trial_would_end
FROM tenants t
WHERE t.slug <> '__platform__'
  AND NOT EXISTS (SELECT 1 FROM suscripciones s WHERE s.tenant_id = t.id)
ORDER BY t.id;
```

Mirá la salida. Si los tenants listados son los que esperás, seguí.

## 3. Backfill real (30 días de trial por tenant legacy)

```sql
-- Crea una fila en suscripciones para cada tenant que no tenga.
-- 30 días de trialing = período de gracia para que los clientes actuales
-- activen su plan antes del bloqueo.
INSERT INTO suscripciones
  (tenant_id, plan_id, estado, trial_starts_at, trial_ends_at, created_at, updated_at)
SELECT
    t.id,
    (SELECT id FROM planes WHERE nombre = 'box-principal'),
    'trialing',
    NOW(),
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW()
FROM tenants t
WHERE t.slug <> '__platform__'
  AND NOT EXISTS (SELECT 1 FROM suscripciones s WHERE s.tenant_id = t.id);

-- Verificación: contar cuántos quedaron
SELECT
    (SELECT COUNT(*) FROM tenants WHERE slug <> '__platform__') AS tenants_totales,
    (SELECT COUNT(*) FROM suscripciones)                         AS suscripciones_creadas,
    (SELECT COUNT(*) FROM suscripciones WHERE estado = 'trialing') AS en_trial;
```

Los 3 contadores deberían dar igual (menos el `__platform__`).

## 4. Registrar la migración en `_prisma_migrations`

Si aplicaste la migración **manualmente por SQL Editor** (y no con `prisma
migrate deploy`), tenés que decirle a Prisma que ya está aplicada. Si no,
el próximo `migrate deploy` va a intentar volver a correrla y fallar por
tabla duplicada.

```sql
INSERT INTO "_prisma_migrations"
    (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
    gen_random_uuid()::text,
    'manual-sql-editor-apply',
    NOW(),
    '20260418000000_add_billing',
    NULL,
    NULL,
    NOW(),
    1
);
```

Si Prisma todavía no tiene esa tabla (proyecto muy viejo), saltate este
bloque — no pasa nada. En el primer `migrate deploy` futuro va a arrancar
de cero.

## Si algo salió mal — rollback

La migración es **puramente aditiva**, no hay datos perdidos posibles.
Para deshacerla:

```sql
DROP TABLE IF EXISTS suscripciones;
DROP TABLE IF EXISTS planes;
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260418000000_add_billing';
```

Todo vuelve a como estaba antes.
