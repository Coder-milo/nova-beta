-- Origen de cada importación.
--
-- La tabla existía pero solo la escribía el importador de estudiantes. Las
-- importaciones del CRM —empresas y colocaciones— y las del libro completo no
-- dejaban rastro: al recargar la pantalla no quedaba nada de quién importó qué
-- ni cuándo, y una carga que metió datos equivocados no se podía ni datar.
--
-- Con tres importadores escribiendo en la misma tabla hace falta saber cuál fue:
-- sin eso, «se importaron 40 registros» no dice si eran participantes, empresas
-- o vinculaciones, y son tres cosas que se corrigen de forma distinta.

ALTER TABLE importacion_historial
    ADD COLUMN origen VARCHAR(20) NOT NULL DEFAULT 'ESTUDIANTES';

-- Las filas que ya existen son todas del importador de estudiantes, que era el
-- único que escribía: el valor por defecto las deja bien clasificadas sin
-- tocarlas.

CREATE INDEX idx_importacion_historial_origen
    ON importacion_historial (origen, created_at DESC);

COMMENT ON COLUMN importacion_historial.origen IS
    'Que importador la hizo: ESTUDIANTES, CRM o LIBRO.';
