-- Chat de grupo entre estudiantes, y las columnas que le faltaban al chat
-- directo (responder, editar y reenviar ya estaban en las entidades).
--
-- Con ddl-auto: validate, una entidad sin su tabla no arranca la aplicacion:
-- no es que fallara al usar el chat, es que no levanta.

ALTER TABLE chat_directo_mensaje ADD COLUMN editado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE chat_directo_mensaje ADD COLUMN reenviado BOOLEAN NOT NULL DEFAULT FALSE;
-- Sin clave foranea a proposito: si se borra el mensaje al que se respondia,
-- la respuesta sigue teniendo sentido por si sola y no debe irse con el.
ALTER TABLE chat_directo_mensaje ADD COLUMN en_respuesta_a UUID;

CREATE TABLE chat_grupo (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    foto_url VARCHAR(500),
    creado_por UUID NOT NULL REFERENCES estudiante(id)
);

-- Al borrar el grupo se van sus miembros y sus mensajes: sin grupo no
-- significan nada, y dejarlos deja filas que nadie puede volver a leer.
CREATE TABLE chat_grupo_miembro (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT,
    grupo_id UUID NOT NULL REFERENCES chat_grupo(id) ON DELETE CASCADE,
    estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
    es_admin BOOLEAN NOT NULL DEFAULT FALSE,
    -- Nadie puede estar dos veces en el mismo grupo. Sin esto, dos pulsaciones
    -- seguidas del boton de anadir dejan a la misma persona duplicada en la
    -- lista y contada dos veces.
    CONSTRAINT uk_chat_grupo_miembro UNIQUE (grupo_id, estudiante_id)
);

CREATE INDEX idx_chat_grupo_miembro_estudiante
    ON chat_grupo_miembro(estudiante_id);

CREATE TABLE chat_grupo_mensaje (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT,
    grupo_id UUID NOT NULL REFERENCES chat_grupo(id) ON DELETE CASCADE,
    remitente_id UUID NOT NULL REFERENCES estudiante(id),
    contenido TEXT NOT NULL,
    editado BOOLEAN NOT NULL DEFAULT FALSE,
    reenviado BOOLEAN NOT NULL DEFAULT FALSE,
    en_respuesta_a UUID
);

CREATE INDEX idx_chat_grupo_mensaje_grupo
    ON chat_grupo_mensaje(grupo_id, created_at DESC);
