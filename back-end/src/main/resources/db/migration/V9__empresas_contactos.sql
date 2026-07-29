CREATE TABLE IF NOT EXISTS contacto_empresa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL REFERENCES empresa(id),
    fecha TIMESTAMP NOT NULL DEFAULT NOW(),
    tipo VARCHAR(80) NOT NULL,
    asunto VARCHAR(255) NOT NULL,
    contacto VARCHAR(255),
    responsable VARCHAR(255),
    notas TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_contacto_empresa_fecha ON contacto_empresa(empresa_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_empresa_sector_activo ON empresa(sector, activo);
