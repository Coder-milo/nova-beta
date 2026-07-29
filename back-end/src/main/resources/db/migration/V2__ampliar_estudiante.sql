ALTER TABLE estudiante
    ADD COLUMN IF NOT EXISTS nacionalidad VARCHAR(100),
    ADD COLUMN IF NOT EXISTS clasificacion_sisben VARCHAR(50),
    ADD COLUMN IF NOT EXISTS situacion_laboral VARCHAR(100),
    ADD COLUMN IF NOT EXISTS ingreso_mensual VARCHAR(100),
    ADD COLUMN IF NOT EXISTS responsable_economico BOOLEAN,
    ADD COLUMN IF NOT EXISTS ha_trabajado BOOLEAN,
    ADD COLUMN IF NOT EXISTS tiene_computador BOOLEAN,
    ADD COLUMN IF NOT EXISTS tiene_internet BOOLEAN,
    ADD COLUMN IF NOT EXISTS motivacion TEXT,
    ADD COLUMN IF NOT EXISTS interes_migratorio BOOLEAN,
    ADD COLUMN IF NOT EXISTS resultado_prueba_escrita VARCHAR(20),
    ADD COLUMN IF NOT EXISTS resultado_prueba_oral VARCHAR(20),
    ADD COLUMN IF NOT EXISTS institucion_educativa VARCHAR(255),
    ADD COLUMN IF NOT EXISTS programa_academico VARCHAR(255),
    ADD COLUMN IF NOT EXISTS area_formacion VARCHAR(255),
    ADD COLUMN IF NOT EXISTS estado_formacion VARCHAR(100),
    ADD COLUMN IF NOT EXISTS disponibilidad_laboral VARCHAR(100),
    ADD COLUMN IF NOT EXISTS estado_busqueda VARCHAR(100),
    ADD COLUMN IF NOT EXISTS postulaciones_enviadas INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS empresas_contactadas INT DEFAULT 0;

INSERT INTO programa (id, nombre, descripcion, duracion_dias, estado, activo)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Ruta Accelerator',
    'Programa de empleabilidad con enfoque en inglés y habilidades blandas para el sector BPO y servicios',
    180,
    'ACTIVO',
    TRUE
);
