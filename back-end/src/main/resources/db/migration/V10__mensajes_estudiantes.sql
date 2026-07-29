CREATE TABLE mensaje_estudiante (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT,
    estudiante_id UUID NOT NULL REFERENCES estudiante(id),
    asunto VARCHAR(160) NOT NULL,
    contenido TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTO',
    respuesta TEXT,
    respondido_por VARCHAR(255),
    respondido_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_mensaje_estudiante_fecha
    ON mensaje_estudiante(estudiante_id, created_at DESC);
CREATE INDEX idx_mensaje_estado
    ON mensaje_estudiante(estado, created_at DESC);
