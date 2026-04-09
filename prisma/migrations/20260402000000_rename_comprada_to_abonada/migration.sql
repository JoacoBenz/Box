-- Drop old check constraint first (so UPDATE can proceed)
ALTER TABLE solicitudes DROP CONSTRAINT IF EXISTS solicitudes_estado_check;

-- Rename state 'comprada' to 'abonada'
UPDATE solicitudes SET estado = 'abonada' WHERE estado = 'comprada';

-- Add new check constraint with 'abonada' instead of 'comprada'
ALTER TABLE solicitudes ADD CONSTRAINT solicitudes_estado_check
CHECK ("estado" IN ('borrador', 'enviada', 'devuelta_resp', 'validada', 'devuelta_dir', 'aprobada', 'rechazada', 'en_compras', 'pago_programado', 'abonada', 'recibida', 'recibida_con_obs', 'anulada', 'cerrada'));
