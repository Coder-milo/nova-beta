-- Cuando el destinatario abrio el mensaje.
--
-- Nulo mientras no lo haya leido, que es a la vez el estado inicial y la
-- consulta que interesa: "cuantos me quedan sin leer" es un IS NULL, no un
-- booleano que hay que mantener en dos sitios. Guardar el instante y no un
-- si/no permite ademas saber cuanto tardo en verse, que es lo que dice si el
-- canal sirve para algo urgente.
ALTER TABLE chat_directo_mensaje
    ADD COLUMN leido_at TIMESTAMP NULL;

-- Lo unico que se consulta por esta columna es lo pendiente de una persona.
CREATE INDEX idx_chat_directo_sin_leer
    ON chat_directo_mensaje (destinatario_id)
    WHERE leido_at IS NULL;
