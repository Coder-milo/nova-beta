-- Datos de la cita y del contacto en la empresa.
--
-- El estado ENTREVISTA_AGENDADA existia desde el principio pero no habia donde
-- apuntar cuando era la entrevista: acababa escrita dentro de `observaciones`,
-- en texto libre. Asi no se podia avisar al estudiante antes de que se le
-- pasara, ni sacar la agenda de la semana, ni saber cuantas citas se quedaron
-- sin cerrar.
--
-- Todas las columnas son nulables: las postulaciones que ya existen no tienen
-- cita, y muchas nunca la tendran porque el proceso muere antes.

ALTER TABLE postulacion
    ADD COLUMN fecha_hora_entrevista TIMESTAMP,
    ADD COLUMN modalidad_entrevista  VARCHAR(20),
    ADD COLUMN lugar_entrevista      VARCHAR(1000),
    ADD COLUMN contacto_nombre       VARCHAR(160),
    ADD COLUMN contacto_email        VARCHAR(160),
    ADD COLUMN contacto_telefono     VARCHAR(40),
    ADD COLUMN proximo_seguimiento   DATE;

-- La agenda pregunta siempre por rango de fechas sobre las que tienen cita.
-- El indice es parcial porque la mayoria de filas no tendran entrevista nunca,
-- y no tiene sentido cargar con ellas un indice que solo se usa para el otro
-- caso.
CREATE INDEX idx_postulacion_entrevista
    ON postulacion (fecha_hora_entrevista)
    WHERE fecha_hora_entrevista IS NOT NULL;

-- Lo mismo para la cola de "hay que volver a mirar esto".
CREATE INDEX idx_postulacion_proximo_seguimiento
    ON postulacion (proximo_seguimiento)
    WHERE proximo_seguimiento IS NOT NULL;

COMMENT ON COLUMN postulacion.fecha_hora_entrevista IS
    'Fecha y hora de la cita. Hora local del programa, sin zona: se opera en una sola.';
COMMENT ON COLUMN postulacion.lugar_entrevista IS
    'Direccion si la modalidad es PRESENCIAL, enlace de reunion si es VIRTUAL.';
COMMENT ON COLUMN postulacion.proximo_seguimiento IS
    'Fecha en la que la postulacion vuelve a la cola de revision.';
