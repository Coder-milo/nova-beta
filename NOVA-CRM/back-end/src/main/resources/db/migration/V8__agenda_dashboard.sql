-- V8: agenda general del dashboard (actividades y notas)

ALTER TABLE actividad
    ALTER COLUMN programa_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS hora TIME,
    ADD COLUMN IF NOT EXISTS descripcion TEXT,
    ADD COLUMN IF NOT EXISTS categoria VARCHAR(40) NOT NULL DEFAULT 'GENERAL';

CREATE INDEX IF NOT EXISTS idx_actividad_agenda
    ON actividad (estado, fecha, hora);
