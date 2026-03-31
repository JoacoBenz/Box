-- Add unique constraint on numero_factura per tenant (NULLs are allowed)
CREATE UNIQUE INDEX IF NOT EXISTS "compras_tenant_id_numero_factura_key"
ON "compras" ("tenant_id", "numero_factura")
WHERE "numero_factura" IS NOT NULL;

-- Add CHECK constraint for valid solicitud states
ALTER TABLE "solicitudes" DROP CONSTRAINT IF EXISTS "solicitudes_estado_check";
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_estado_check"
CHECK ("estado" IN ('borrador', 'enviada', 'devuelta_resp', 'validada', 'devuelta_dir', 'aprobada', 'rechazada', 'en_compras', 'pago_programado', 'comprada', 'recibida', 'recibida_con_obs', 'anulada', 'cerrada'));
