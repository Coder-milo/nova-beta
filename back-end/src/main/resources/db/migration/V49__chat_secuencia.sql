-- Orden real de los mensajes del chat, igual que se hizo con los turnos.
--
-- Se ordenaba solo por created_at, que lo pone el reloj del sistema: dos
-- mensajes escritos en el mismo milisegundo salen con el mismo valor y la base
-- devuelve el orden que quiere. En una conversacion eso significa leerla al
-- reves, y aqui pasa igual que en la mensajeria con el equipo.
--
-- Tambien afecta a la lista de conversaciones: el resumen enseña "el ultimo
-- mensaje", y con dos empatados el ultimo era el que la base eligiera.
ALTER TABLE chat_directo_mensaje ADD COLUMN secuencia BIGSERIAL;
ALTER TABLE chat_grupo_mensaje ADD COLUMN secuencia BIGSERIAL;

-- Lo ya escrito se numera por su fecha, para que se siga viendo igual.
WITH ordenados AS (
    SELECT id, row_number() OVER (ORDER BY created_at, id) AS n
    FROM chat_directo_mensaje
)
UPDATE chat_directo_mensaje m
   SET secuencia = ordenados.n
  FROM ordenados
 WHERE m.id = ordenados.id;

WITH ordenados AS (
    SELECT id, row_number() OVER (ORDER BY created_at, id) AS n
    FROM chat_grupo_mensaje
)
UPDATE chat_grupo_mensaje m
   SET secuencia = ordenados.n
  FROM ordenados
 WHERE m.id = ordenados.id;

SELECT setval(pg_get_serial_sequence('chat_directo_mensaje', 'secuencia'),
              COALESCE((SELECT MAX(secuencia) FROM chat_directo_mensaje), 1));
SELECT setval(pg_get_serial_sequence('chat_grupo_mensaje', 'secuencia'),
              COALESCE((SELECT MAX(secuencia) FROM chat_grupo_mensaje), 1));

CREATE INDEX idx_chat_directo_orden ON chat_directo_mensaje (created_at DESC, secuencia DESC);
CREATE INDEX idx_chat_grupo_orden ON chat_grupo_mensaje (grupo_id, created_at DESC, secuencia DESC);
