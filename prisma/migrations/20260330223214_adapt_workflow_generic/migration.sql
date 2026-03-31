-- AlterTable
ALTER TABLE "solicitudes" ADD COLUMN     "centro_costo_id" INTEGER,
ADD COLUMN     "dia_pago_programado" DATE,
ADD COLUMN     "fecha_procesamiento" TIMESTAMP(3),
ADD COLUMN     "observaciones_compras" TEXT,
ADD COLUMN     "prioridad_compra" VARCHAR(20),
ADD COLUMN     "procesado_por_id" INTEGER,
ADD COLUMN     "tipo" VARCHAR(20) NOT NULL DEFAULT 'formal';

-- CreateTable
CREATE TABLE "centros_costo" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "centros_costo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "centros_costo_tenant_id_codigo_key" ON "centros_costo"("tenant_id", "codigo");

-- AddForeignKey
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_centro_costo_id_fkey" FOREIGN KEY ("centro_costo_id") REFERENCES "centros_costo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_procesado_por_id_fkey" FOREIGN KEY ("procesado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "centros_costo" ADD CONSTRAINT "centros_costo_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
