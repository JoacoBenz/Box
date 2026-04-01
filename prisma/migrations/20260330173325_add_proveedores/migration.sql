-- AlterTable
ALTER TABLE "compras" ADD COLUMN     "proveedor_id" INTEGER;

-- AlterTable
ALTER TABLE "items_solicitud" ADD COLUMN     "link_producto" VARCHAR(500);

-- AlterTable
ALTER TABLE "solicitudes" ADD COLUMN     "proveedor_id" INTEGER;

-- CreateTable
CREATE TABLE "proveedores" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "cuit" VARCHAR(13),
    "datos_bancarios" TEXT,
    "link_pagina" VARCHAR(500),
    "telefono" VARCHAR(50),
    "email" VARCHAR(255),
    "direccion" VARCHAR(500),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proveedores_tenant_id_nombre_idx" ON "proveedores"("tenant_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_tenant_id_cuit_key" ON "proveedores"("tenant_id", "cuit");

-- AddForeignKey
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
