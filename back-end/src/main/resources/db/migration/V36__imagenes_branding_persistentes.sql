-- Las imagenes de identidad son pequenas (maximo 2 MB) y deben sobrevivir a
-- los reemplazos del contenedor de Render. El disco local de ese servicio es
-- efimero, por lo que se almacenan en PostgreSQL junto con su tipo MIME.
CREATE TABLE branding_imagen (
    clave VARCHAR(160) PRIMARY KEY,
    content_type VARCHAR(40) NOT NULL,
    contenido BYTEA NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
