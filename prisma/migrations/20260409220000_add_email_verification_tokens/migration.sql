CREATE TABLE "tokens_verificacion_email" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_el" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_verificacion_email_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tokens_verificacion_email_token_hash_key" ON "tokens_verificacion_email"("token_hash");
CREATE INDEX "tokens_verificacion_email_usuario_id_idx" ON "tokens_verificacion_email"("usuario_id");

ALTER TABLE "tokens_verificacion_email" ADD CONSTRAINT "tokens_verificacion_email_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
