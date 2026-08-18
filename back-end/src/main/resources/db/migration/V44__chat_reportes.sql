-- Reportes del chat entre estudiantes.
--
-- El extracto se guarda como texto y no como referencia a los mensajes: quien
-- acosa borra, y un reporte que apunta a mensajes borrados no le sirve a nadie.
-- El equipo abriria el caso y no encontraria nada de lo que se denuncio.
--
-- Por lo mismo, el reporte no se va con los mensajes ni se puede editar desde
-- el chat: es lo que se enseño al pedir ayuda, congelado en ese momento.
CREATE TABLE chat_reporte (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT,
    denunciante_id UUID NOT NULL REFERENCES estudiante(id),
    denunciado_id UUID NOT NULL REFERENCES estudiante(id),
    motivo VARCHAR(1000),
    extracto TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTO',
    CONSTRAINT chk_chat_reporte_distintos CHECK (denunciante_id <> denunciado_id)
);

CREATE INDEX idx_chat_reporte_estado ON chat_reporte(estado);
CREATE INDEX idx_chat_reporte_denunciado ON chat_reporte(denunciado_id);
