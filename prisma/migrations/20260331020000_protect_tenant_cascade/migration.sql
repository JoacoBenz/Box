-- Add soft-delete field to tenants
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "desactivado" BOOLEAN NOT NULL DEFAULT false;

-- Change critical relations from CASCADE to RESTRICT
ALTER TABLE "solicitudes" DROP CONSTRAINT IF EXISTS "solicitudes_tenant_id_fkey";
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "compras" DROP CONSTRAINT IF EXISTS "compras_tenant_id_fkey";
ALTER TABLE "compras" ADD CONSTRAINT "compras_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recepciones" DROP CONSTRAINT IF EXISTS "recepciones_tenant_id_fkey";
ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "log_auditoria" DROP CONSTRAINT IF EXISTS "log_auditoria_tenant_id_fkey";
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "archivos" DROP CONSTRAINT IF EXISTS "archivos_tenant_id_fkey";
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "proveedores" DROP CONSTRAINT IF EXISTS "proveedores_tenant_id_fkey";
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
