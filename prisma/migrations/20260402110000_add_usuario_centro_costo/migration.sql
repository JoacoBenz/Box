-- Add centro_costo_id to usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS centro_costo_id INTEGER;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_centro_costo_id_fkey FOREIGN KEY (centro_costo_id) REFERENCES centros_costo(id) ON DELETE SET NULL;
