-- Budget control fields for cost centers
ALTER TABLE "centros_costo" ADD COLUMN IF NOT EXISTS "presupuesto_anual" DECIMAL(15,2);
ALTER TABLE "centros_costo" ADD COLUMN IF NOT EXISTS "presupuesto_mensual" DECIMAL(15,2);
