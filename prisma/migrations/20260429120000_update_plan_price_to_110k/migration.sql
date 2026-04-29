-- Update box-principal plan price from 152000 to 110000 ARS/mo.
-- Companion change in MP: edit the Preapproval Plan amount in MP dashboard
-- (MP allows editing the plan template — confirmed 2026-04). Existing
-- preapprovals may retain the previous amount snapshotted at signup;
-- verify in MP dashboard whether the new amount propagated, otherwise
-- cancel/resubscribe affected tenants.
UPDATE "planes" SET "precio_ars" = 110000 WHERE "nombre" = 'box-principal';
