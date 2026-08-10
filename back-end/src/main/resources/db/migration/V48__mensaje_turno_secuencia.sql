-- Orden real de los turnos de una conversacion.
--
-- Se ordenaba solo por created_at, y esa marca la pone el reloj del sistema:
-- dos intervenciones escritas en el mismo milisegundo salen con el mismo
-- valor y la base devuelve el orden que quiere. Se veia en una prueba que
-- fallaba de vez en cuando —la respuesta del coordinador aparecia antes que la
-- pregunta del estudiante—, y lo que fallaba no era la prueba: una
-- conversacion puede leerse al reves, que es justo lo que no puede pasarle a
-- una conversacion.
--
-- La secuencia la asigna la base al insertar, asi que no depende del reloj ni
-- de la resolucion que tenga en la maquina donde corra.
ALTER TABLE mensaje_turno ADD COLUMN secuencia BIGSERIAL;

-- Las que ya existen se numeran por su fecha, para que el orden de lo antiguo
-- siga siendo el que se veia. Entre las que empatan, cualquiera vale: si
-- empatan es que se escribieron a la vez y ya no hay forma de saberlo.
WITH ordenadas AS (
    SELECT id, row_number() OVER (ORDER BY created_at, id) AS n
    FROM mensaje_turno
)
UPDATE mensaje_turno t
   SET secuencia = ordenadas.n
  FROM ordenadas
 WHERE t.id = ordenadas.id;

SELECT setval(pg_get_serial_sequence('mensaje_turno', 'secuencia'),
              COALESCE((SELECT MAX(secuencia) FROM mensaje_turno), 1));

CREATE INDEX idx_mensaje_turno_orden ON mensaje_turno (mensaje_id, created_at, secuencia);
