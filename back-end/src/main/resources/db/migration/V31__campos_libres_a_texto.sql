-- Campos que el equipo usa como texto libre y no caben en varchar(255).
--
-- La hoja de seguimiento del programa los llena a mano y sin tope. En el libro
-- real, "Carrera / Titulo" llega a 1115 caracteres y "Cargos que puede aplicar"
-- a 307: no son etiquetas, son descripciones. Con varchar(255) la importacion
-- fallaba con un error de longitud que no decia ni la fila ni la columna, y
-- recortar a 255 habria perdido casi mil caracteres escritos por alguien.
--
-- `competencias` ya era TEXT; se dejan aqui las dos que faltaban. Postgres
-- convierte varchar a text sin reescribir la tabla ni perder datos.

ALTER TABLE estudiante
    ALTER COLUMN area_formacion TYPE TEXT,
    ALTER COLUMN cargo_objetivo TYPE TEXT;

COMMENT ON COLUMN estudiante.area_formacion IS
    'Carrera o titulo, tal como lo escribe el participante. Texto libre: en el seguimiento hay respuestas de mas de mil caracteres.';
COMMENT ON COLUMN estudiante.cargo_objetivo IS
    'Cargos a los que puede aplicar. Suele ser una lista, no un unico cargo.';
