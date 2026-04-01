-- Partial receipt support: item-level tracking
CREATE TABLE "items_recepcion" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "recepcion_id" INTEGER NOT NULL,
    "item_solicitud_id" INTEGER NOT NULL,
    "cantidad_recibida" DECIMAL(10,2) NOT NULL,
    "conforme" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,

    CONSTRAINT "items_recepcion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "items_recepcion" ADD CONSTRAINT "items_recepcion_recepcion_id_fkey"
FOREIGN KEY ("recepcion_id") REFERENCES "recepciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "items_recepcion" ADD CONSTRAINT "items_recepcion_item_solicitud_id_fkey"
FOREIGN KEY ("item_solicitud_id") REFERENCES "items_solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "items_recepcion_recepcion_id_idx" ON "items_recepcion"("recepcion_id");
CREATE INDEX "items_recepcion_item_solicitud_id_idx" ON "items_recepcion"("item_solicitud_id");
