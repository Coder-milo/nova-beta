CREATE TABLE mensaje_adjunto (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT,
    mensaje_id UUID NOT NULL REFERENCES mensaje_estudiante(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    object_key TEXT NOT NULL,
    content_type VARCHAR(255) NOT NULL,
    tamano BIGINT NOT NULL
);

CREATE INDEX idx_mensaje_adjunto_mensaje
    ON mensaje_adjunto(mensaje_id, created_at ASC);
