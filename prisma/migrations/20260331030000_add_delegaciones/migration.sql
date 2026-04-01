CREATE TABLE "delegaciones" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "delegante_id" INTEGER NOT NULL,
    "delegado_id" INTEGER NOT NULL,
    "rol_delegado" VARCHAR(50) NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "motivo" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegaciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delegaciones_tenant_id_delegante_id_delegado_id_rol_delegado_fecha_inicio_key"
ON "delegaciones"("tenant_id", "delegante_id", "delegado_id", "rol_delegado", "fecha_inicio");

CREATE INDEX "delegaciones_tenant_id_delegado_id_activo_idx"
ON "delegaciones"("tenant_id", "delegado_id", "activo");

ALTER TABLE "delegaciones" ADD CONSTRAINT "delegaciones_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delegaciones" ADD CONSTRAINT "delegaciones_delegante_id_fkey"
FOREIGN KEY ("delegante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "delegaciones" ADD CONSTRAINT "delegaciones_delegado_id_fkey"
FOREIGN KEY ("delegado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
