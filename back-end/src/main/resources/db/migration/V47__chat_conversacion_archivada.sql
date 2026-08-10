-- Conversaciones que alguien aparta de su bandeja.
--
-- Es de cada uno: que yo archive una conversacion no la archiva para el otro,
-- igual que guardar una carta en un cajon no se la quita a quien la escribio.
-- Por eso la clave es el par (quien archiva, con quien), y no la conversacion.
--
-- Archivar no borra nada ni corta nada. Si llega un mensaje nuevo, la
-- conversacion vuelve a la bandeja: apartar algo no puede significar dejar de
-- enterarse de lo que pasa en ello. Eso se resuelve al leer, comparando con la
-- fecha de archivado.
CREATE TABLE chat_archivada (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT,
    estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
    contacto_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
    CONSTRAINT uk_chat_archivada UNIQUE (estudiante_id, contacto_id),
    CONSTRAINT chk_chat_archivada_distintos CHECK (estudiante_id <> contacto_id)
);

CREATE INDEX idx_chat_archivada_estudiante ON chat_archivada(estudiante_id);
