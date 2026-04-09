-- Add presupuesto fields to areas
ALTER TABLE areas ADD COLUMN IF NOT EXISTS presupuesto_anual DECIMAL(15,2);
ALTER TABLE areas ADD COLUMN IF NOT EXISTS presupuesto_mensual DECIMAL(15,2);

-- Add area_id to centros_costo to link them to areas
ALTER TABLE centros_costo ADD COLUMN IF NOT EXISTS area_id INTEGER;
ALTER TABLE centros_costo ADD CONSTRAINT centros_costo_area_id_fkey FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL;
