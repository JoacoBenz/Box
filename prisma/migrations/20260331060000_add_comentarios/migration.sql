CREATE TABLE "comentarios" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "solicitud_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "mensaje" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "comentarios_tenant_id_solicitud_id_idx" ON "comentarios"("tenant_id", "solicitud_id");

ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_solicitud_id_fkey"
FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_usuario_id_fkey"
FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
