-- Enable daily pending-requests digest emails by default for newly created users.
-- Existing users keep their current preference (no backfill).
ALTER TABLE "usuarios" ALTER COLUMN "email_digest" SET DEFAULT true;
