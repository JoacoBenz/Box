-- Update box-principal plan price from 152000 to 110000 ARS/mo.
-- Existing subscribers with a Preapproval bound to the old MP_PLAN_ID
-- will continue paying the previous amount until migrated to a new
-- Preapproval Plan (created manually in MP dashboard, then MP_PLAN_ID
-- env var updated in Vercel).
UPDATE "planes" SET "precio_ars" = 110000 WHERE "nombre" = 'box-principal';
