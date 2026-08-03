-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Catalogos
-- ============================================================

CREATE TABLE catalogo_nivel_ingles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(255) NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE catalogo_habilidad (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL UNIQUE,
    categoria VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);

-- ============================================================
-- Programa
-- ============================================================

CREATE TABLE programa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    duracion_dias INT,
    fecha_inicio DATE,
    fecha_fin DATE,
    config_matching JSONB,
    logo_url TEXT,
    estado VARCHAR(50) NOT NULL DEFAULT 'BORRADOR',
    fecha_finalizacion TIMESTAMP,
    fecha_archivado TIMESTAMP,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_programa_activo ON programa(activo);

-- ============================================================
-- Empresa
-- ============================================================

CREATE TABLE empresa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL UNIQUE,
    sector VARCHAR(255),
    sitio_web VARCHAR(500),
    telefono VARCHAR(50),
    email VARCHAR(255),
    direccion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);

-- ============================================================
-- Estudiante
-- ============================================================

CREATE TABLE estudiante (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programa_id UUID NOT NULL REFERENCES programa(id),
    nivel_ingles_id UUID REFERENCES catalogo_nivel_ingles(id),
    nombre VARCHAR(255) NOT NULL,
    apellidos VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telefono VARCHAR(50),
    celular VARCHAR(50),
    ciudad VARCHAR(255),
    barrio VARCHAR(255),
    tipo_documento VARCHAR(50),
    numero_documento VARCHAR(100),
    fecha_nacimiento DATE,
    genero VARCHAR(50),
    nivel_educativo VARCHAR(255),
    titulo VARCHAR(255),
    anios_experiencia INT,
    sector_experiencia VARCHAR(255),
    ultimo_cargo VARCHAR(255),
    perfil_profesional TEXT,
    sector_objetivo VARCHAR(255),
    cargo_objetivo VARCHAR(255),
    disponibilidad_movilidad BOOLEAN,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    linkedin_user_id VARCHAR(255),
    linkedin_access_token TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_estudiante_programa ON estudiante(programa_id);
CREATE INDEX idx_estudiante_activo ON estudiante(activo);
CREATE INDEX idx_estudiante_email ON estudiante(email);

-- ============================================================
-- Estudiante - Habilidad (N:N)
-- ============================================================

CREATE TABLE estudiante_habilidad (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
    habilidad_id UUID NOT NULL REFERENCES catalogo_habilidad(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE(estudiante_id, habilidad_id)
);

-- ============================================================
-- Vacante
-- ============================================================

CREATE TABLE vacante (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID REFERENCES empresa(id),
    titulo VARCHAR(500) NOT NULL,
    descripcion TEXT,
    requisitos TEXT,
    ubicacion VARCHAR(255),
    rango_salarial VARCHAR(255),
    tipo_contrato VARCHAR(100),
    modalidad_trabajo VARCHAR(100),
    nivel_ingles_requerido VARCHAR(100),
    anios_experiencia_requeridos INT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fuente VARCHAR(100),
    url_origen TEXT,
    url_aplicar TEXT,
    fecha_publicacion TIMESTAMP,
    fecha_expiracion TIMESTAMP,
    hash_dedup VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_vacante_activo_fecha ON vacante(activo, created_at);

-- ============================================================
-- Match
-- ============================================================

CREATE TABLE match_resultado (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
    vacante_id UUID NOT NULL REFERENCES vacante(id) ON DELETE CASCADE,
    puntaje DECIMAL(5,2) NOT NULL,
    notificado BOOLEAN NOT NULL DEFAULT FALSE,
    postulado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_match_estudiante_notificado ON match_resultado(estudiante_id, notificado);

-- ============================================================
-- Certificacion
-- ============================================================

CREATE TABLE certificacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programa_id UUID REFERENCES programa(id),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    horas_curriculares INT,
    habilidades_cubiertas TEXT,
    texto_compartir TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);

-- ============================================================
-- Estudiante - Certificacion (N:N)
-- ============================================================

CREATE TABLE estudiante_certificacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
    certificacion_id UUID NOT NULL REFERENCES certificacion(id) ON DELETE CASCADE,
    fecha_emision DATE NOT NULL,
    emitida BOOLEAN NOT NULL DEFAULT FALSE,
    compartida_linkedin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE(estudiante_id, certificacion_id)
);

-- ============================================================
-- Credencial (verificacion publica)
-- ============================================================

CREATE TABLE credencial (
    id UUID PRIMARY KEY REFERENCES estudiante_certificacion(id) ON DELETE CASCADE,
    uuid_publico UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    fecha_generacion TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_expiracion TIMESTAMP,
    revocada BOOLEAN NOT NULL DEFAULT FALSE,
    pdf_url TEXT,
    token_verificacion VARCHAR(255) UNIQUE
);

CREATE INDEX idx_credencial_uuid ON credencial(uuid_publico);

-- ============================================================
-- Notificacion
-- ============================================================

CREATE TABLE notificacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
    titulo VARCHAR(500) NOT NULL,
    mensaje TEXT,
    tipo VARCHAR(50),
    referencia_id VARCHAR(255),
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_envio_email TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_notificacion_estudiante_leida ON notificacion(estudiante_id, leida);

-- ============================================================
-- LinkedIn
-- ============================================================

CREATE TABLE linkedin_configuracion (
    id UUID PRIMARY KEY REFERENCES estudiante(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    token_expira_en TIMESTAMP,
    linkedin_user_id VARCHAR(255),
    linkedin_urn VARCHAR(255)
);

CREATE INDEX idx_linkedin_estudiante ON linkedin_configuracion(id);

-- ============================================================
-- Usuarios / Auth
-- ============================================================

CREATE TABLE usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE usuario_rol (
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    rol VARCHAR(50) NOT NULL,
    PRIMARY KEY (usuario_id, rol)
);

-- ============================================================
-- Seed data: admin por defecto (password: admin123)
-- ============================================================

INSERT INTO usuario (id, email, password, nombre, activo)
VALUES (
    uuid_generate_v4(),
    'admin@novacrm.com',
    '$2a$10$.XT99VGrzqD16sUXmhyJ0OAmD3MxkJV7E77eiPoz31KY8AFUGjNTe',
    'Administrador del Sistema',
    TRUE
);

INSERT INTO usuario_rol (usuario_id, rol)
SELECT id, 'ADMIN' FROM usuario WHERE email = 'admin@novacrm.com';

-- Niveles de ingles por defecto
INSERT INTO catalogo_nivel_ingles (codigo, nombre, orden) VALUES
('A1', 'Principiante (A1)', 1),
('A2', 'Basico (A2)', 2),
('B1', 'Intermedio (B1)', 3),
('B2', 'Intermedio Alto (B2)', 4),
('C1', 'Avanzado (C1)', 5),
('C2', 'Nativo (C2)', 6);
