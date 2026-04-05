-- Add OAuth fields to usuarios
ALTER TABLE "usuarios" ADD COLUMN "oauth_provider" VARCHAR(20);
ALTER TABLE "usuarios" ADD COLUMN "oauth_sub" VARCHAR(255);
ALTER TABLE "usuarios" ADD COLUMN "area_sugerida" VARCHAR(150);

-- Unique constraint for OAuth
CREATE UNIQUE INDEX "usuarios_oauth_provider_oauth_sub_key" ON "usuarios"("oauth_provider", "oauth_sub");

-- Password reset tokens
CREATE TABLE "tokens_password_reset" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_el" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_password_reset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tokens_password_reset_token_hash_key" ON "tokens_password_reset"("token_hash");
CREATE INDEX "tokens_password_reset_email_created_at_idx" ON "tokens_password_reset"("email", "created_at");

-- Pending registrations
CREATE TABLE "registros_pendientes" (
    "id" SERIAL NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "nombre_organizacion" VARCHAR(255) NOT NULL,
    "nombre_usuario" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "expira_el" TIMESTAMP(3) NOT NULL,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_pendientes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registros_pendientes_token_hash_key" ON "registros_pendientes"("token_hash");
CREATE INDEX "registros_pendientes_email_idx" ON "registros_pendientes"("email");
