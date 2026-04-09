/*
  Warnings:

  - You are about to drop the column `monto_estimado_total` on the `solicitudes` table. All the data in the column will be lost.
  - Made the column `area_id` on table `centros_costo` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "centros_costo" DROP CONSTRAINT "centros_costo_area_id_fkey";

-- DropForeignKey
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_centro_costo_id_fkey";

-- DropIndex
DROP INDEX "items_recepcion_item_solicitud_id_idx";

-- DropIndex
DROP INDEX "items_recepcion_recepcion_id_idx";

-- AlterTable
ALTER TABLE "centros_costo" ALTER COLUMN "area_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "items_solicitud" ADD COLUMN     "producto_id" INTEGER;

-- AlterTable
ALTER TABLE "solicitudes" DROP COLUMN "monto_estimado_total";

-- AlterTable
ALTER TABLE "usuarios" ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "codigos_invitacion" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "codigo" VARCHAR(8) NOT NULL,
    "creado_por" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "usos" INTEGER NOT NULL DEFAULT 0,
    "max_usos" INTEGER,
    "expira_el" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_invitacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "categoria" VARCHAR(100),
    "unidad_defecto" VARCHAR(50) NOT NULL DEFAULT 'unidades',
    "precio_referencia" DECIMAL(15,2),
    "link_producto" VARCHAR(500),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "codigos_invitacion_codigo_key" ON "codigos_invitacion"("codigo");

-- CreateIndex
CREATE INDEX "codigos_invitacion_tenant_id_activo_idx" ON "codigos_invitacion"("tenant_id", "activo");

-- CreateIndex
CREATE INDEX "productos_tenant_id_activo_idx" ON "productos"("tenant_id", "activo");

-- CreateIndex
CREATE INDEX "productos_tenant_id_categoria_idx" ON "productos"("tenant_id", "categoria");

-- CreateIndex
CREATE UNIQUE INDEX "productos_tenant_id_nombre_key" ON "productos"("tenant_id", "nombre");

-- CreateIndex
CREATE INDEX "archivos_tenant_id_entidad_entidad_id_idx" ON "archivos"("tenant_id", "entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "compras_tenant_id_fecha_compra_idx" ON "compras"("tenant_id", "fecha_compra");

-- CreateIndex
CREATE INDEX "items_solicitud_solicitud_id_idx" ON "items_solicitud"("solicitud_id");

-- CreateIndex
CREATE INDEX "items_solicitud_tenant_id_solicitud_id_idx" ON "items_solicitud"("tenant_id", "solicitud_id");

-- CreateIndex
CREATE INDEX "log_auditoria_tenant_id_usuario_id_idx" ON "log_auditoria"("tenant_id", "usuario_id");

-- CreateIndex
CREATE INDEX "recepciones_tenant_id_solicitud_id_idx" ON "recepciones"("tenant_id", "solicitud_id");

-- CreateIndex
CREATE INDEX "solicitudes_tenant_id_validado_por_id_idx" ON "solicitudes"("tenant_id", "validado_por_id");

-- CreateIndex
CREATE INDEX "solicitudes_tenant_id_aprobado_por_id_idx" ON "solicitudes"("tenant_id", "aprobado_por_id");

-- CreateIndex
CREATE INDEX "solicitudes_tenant_id_rechazado_por_id_idx" ON "solicitudes"("tenant_id", "rechazado_por_id");

-- CreateIndex
CREATE INDEX "solicitudes_tenant_id_procesado_por_id_idx" ON "solicitudes"("tenant_id", "procesado_por_id");

-- CreateIndex
CREATE INDEX "usuarios_roles_rol_id_idx" ON "usuarios_roles"("rol_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_centro_costo_id_fkey" FOREIGN KEY ("centro_costo_id") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_solicitud" ADD CONSTRAINT "items_solicitud_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_costo" ADD CONSTRAINT "centros_costo_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_invitacion" ADD CONSTRAINT "codigos_invitacion_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_invitacion" ADD CONSTRAINT "codigos_invitacion_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "delegaciones_tenant_id_delegante_id_delegado_id_rol_delegado_fe" RENAME TO "delegaciones_tenant_id_delegante_id_delegado_id_rol_delegad_key";
