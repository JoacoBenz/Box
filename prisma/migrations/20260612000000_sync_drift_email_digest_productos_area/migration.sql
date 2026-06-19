-- Sync drift: estos cambios existían en las DBs creadas con `db push` pero nunca
-- tuvieron migración, así que una base nueva con `migrate deploy` quedaba sin ellos.
-- Todo es idempotente (IF EXISTS / IF NOT EXISTS) para que también aplique limpio
-- sobre bases que ya tienen el estado final.

-- productos: categoria (texto libre) fue reemplazada por area_id
DROP INDEX IF EXISTS "productos_tenant_id_categoria_idx";
ALTER TABLE "productos" DROP COLUMN IF EXISTS "categoria";
ALTER TABLE "productos" ADD COLUMN IF NOT EXISTS "area_id" INTEGER;

-- usuarios: preferencia de digest diario por email
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "email_digest" BOOLEAN NOT NULL DEFAULT false;

-- Índices
CREATE INDEX IF NOT EXISTS "items_recepcion_tenant_id_recepcion_id_idx" ON "items_recepcion"("tenant_id", "recepcion_id");
CREATE INDEX IF NOT EXISTS "productos_tenant_id_area_id_idx" ON "productos"("tenant_id", "area_id");

-- FK productos.area_id → areas.id (condicional: puede ya existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'productos_area_id_fkey'
  ) THEN
    ALTER TABLE "productos" ADD CONSTRAINT "productos_area_id_fkey"
      FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Rename del índice de rate_limits al nombre que espera Prisma
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rate_limits_window')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'rate_limits_window_start_idx') THEN
    ALTER INDEX "idx_rate_limits_window" RENAME TO "rate_limits_window_start_idx";
  END IF;
END $$;
