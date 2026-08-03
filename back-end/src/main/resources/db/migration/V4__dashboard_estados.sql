-- Estados estables para los graficos del dashboard (torta y dona).
ALTER TABLE estudiante
    ADD COLUMN IF NOT EXISTS estado_academico VARCHAR(30) NOT NULL DEFAULT 'ACTIVO',
    ADD COLUMN IF NOT EXISTS estado_empleabilidad VARCHAR(30) NOT NULL DEFAULT 'SIN_INFO';

CREATE INDEX IF NOT EXISTS idx_estudiante_estado_academico ON estudiante(estado_academico);
