-- Papelera de reciclaje: columna para saber cuándo se eliminó cada estudiante.
ALTER TABLE estudiante
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_estudiante_deleted_at ON estudiante(deleted_at);
