-- Bloqueos del chat entre estudiantes.
--
-- Se guarda en una direccion —quien bloqueo a quien— pero corta el chat en las
-- dos: mientras exista, ninguno de los dos puede escribir al otro. Si fuera
-- solo de un lado, quien bloquea podria seguir escribiendo a quien le bloqueo,
-- y eso convierte una herramienta para protegerse en una para insistir.
--
-- Lo ya escrito no se borra: sigue estando para leerlo y para reportarlo.
CREATE TABLE chat_bloqueo (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT,
    bloqueador_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
    bloqueado_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
    CONSTRAINT uk_chat_bloqueo UNIQUE (bloqueador_id, bloqueado_id),
    CONSTRAINT chk_chat_bloqueo_distintos CHECK (bloqueador_id <> bloqueado_id)
);

-- Se consulta en los dos sentidos antes de cada mensaje.
CREATE INDEX idx_chat_bloqueo_bloqueado ON chat_bloqueo(bloqueado_id);
