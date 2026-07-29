CREATE TABLE chat_directo_mensaje (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT,
    remitente_id UUID NOT NULL REFERENCES estudiante(id),
    destinatario_id UUID NOT NULL REFERENCES estudiante(id),
    contenido TEXT NOT NULL,
    CONSTRAINT chk_chat_directo_distintos CHECK (remitente_id <> destinatario_id)
);

CREATE INDEX idx_chat_directo_remitente
    ON chat_directo_mensaje(remitente_id, created_at ASC);
CREATE INDEX idx_chat_directo_destinatario
    ON chat_directo_mensaje(destinatario_id, created_at ASC);
