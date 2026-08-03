-- V6: módulos del diseño Figma — proyectos enriquecidos, perfil profundo de estudiante,
-- documentos, seguimientos, auditoría, actividades, hojas de vida e historial de importaciones.

-- ── Programa enriquecido ────────────────────────────────────────────────────
ALTER TABLE programa
    ADD COLUMN IF NOT EXISTS cliente VARCHAR(255),
    ADD COLUMN IF NOT EXISTS responsable VARCHAR(255),
    ADD COLUMN IF NOT EXISTS observaciones TEXT,
    ADD COLUMN IF NOT EXISTS porcentaje_avance INT NOT NULL DEFAULT 0;

-- ── Estudiante: campos personales y profesionales ───────────────────────────
ALTER TABLE estudiante
    ADD COLUMN IF NOT EXISTS direccion VARCHAR(255),
    ADD COLUMN IF NOT EXISTS foto_url TEXT,
    ADD COLUMN IF NOT EXISTS competencias TEXT,
    ADD COLUMN IF NOT EXISTS idiomas TEXT,
    ADD COLUMN IF NOT EXISTS referencias TEXT,
    ADD COLUMN IF NOT EXISTS disponibilidad VARCHAR(100);

-- ── Formación adicional (múltiple por estudiante) ───────────────────────────
CREATE TABLE IF NOT EXISTS formacion_adicional (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL,
    institucion VARCHAR(255) NOT NULL,
    programa VARCHAR(255) NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado VARCHAR(30),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_formacion_estudiante ON formacion_adicional(estudiante_id);

-- ── Experiencia laboral (múltiple por estudiante) ───────────────────────────
CREATE TABLE IF NOT EXISTS experiencia_laboral (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
    empresa VARCHAR(255) NOT NULL,
    cargo VARCHAR(255) NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    relacionada BOOLEAN NOT NULL DEFAULT FALSE,
    funciones TEXT,
    actual BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_experiencia_estudiante ON experiencia_laboral(estudiante_id);

-- ── Documentos (MinIO) con versiones ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID NOT NULL,                -- mismo grupo = mismo documento lógico (versiones)
    numero_version INT NOT NULL DEFAULT 1,
    estudiante_id UUID REFERENCES estudiante(id) ON DELETE CASCADE,
    programa_id UUID REFERENCES programa(id) ON DELETE CASCADE,
    tipo VARCHAR(40) NOT NULL,
    nombre VARCHAR(500) NOT NULL,
    object_key TEXT NOT NULL,
    content_type VARCHAR(150),
    tamano BIGINT NOT NULL DEFAULT 0,
    subido_por VARCHAR(255),
    actual BOOLEAN NOT NULL DEFAULT TRUE,  -- versión vigente del grupo
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_documento_estudiante ON documento(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_documento_programa ON documento(programa_id);
CREATE INDEX IF NOT EXISTS idx_documento_grupo ON documento(grupo_id);

-- ── Seguimientos por estudiante ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seguimiento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo VARCHAR(50) NOT NULL,
    responsable VARCHAR(255),
    observacion TEXT,
    proxima_accion TEXT,
    fecha_proxima DATE,
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_seguimiento_estudiante ON seguimiento(estudiante_id);

-- ── Auditoría ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha TIMESTAMP NOT NULL DEFAULT NOW(),
    usuario VARCHAR(255) NOT NULL,
    modulo VARCHAR(60) NOT NULL,
    accion VARCHAR(40) NOT NULL,
    entidad VARCHAR(60) NOT NULL,
    registro_id VARCHAR(60),
    registro_nombre VARCHAR(500),
    datos_anteriores TEXT,
    datos_nuevos TEXT,
    ip VARCHAR(60)
);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_registro ON auditoria(registro_id);

-- ── Actividades de proyecto ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS actividad (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programa_id UUID NOT NULL REFERENCES programa(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    responsable VARCHAR(255),
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_actividad_programa_fecha ON actividad(programa_id, fecha);

-- ── Plantillas de hoja de vida ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plantilla_hv (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    object_key TEXT,                        -- archivo de referencia subido (opcional)
    content_type VARCHAR(150),
    color_primario VARCHAR(20) NOT NULL DEFAULT '#1C315E',
    predeterminada BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);

-- ── Hojas de vida generadas (versionadas por estudiante) ────────────────────
CREATE TABLE IF NOT EXISTS hoja_de_vida (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id UUID NOT NULL REFERENCES estudiante(id) ON DELETE CASCADE,
    plantilla_id UUID REFERENCES plantilla_hv(id),
    numero_version INT NOT NULL DEFAULT 1,
    object_key TEXT NOT NULL,
    actual BOOLEAN NOT NULL DEFAULT TRUE,
    generada_por VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_hv_estudiante ON hoja_de_vida(estudiante_id);

-- ── Historial de importaciones ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS importacion_historial (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    archivo VARCHAR(500) NOT NULL,
    usuario VARCHAR(255) NOT NULL,
    programa_id UUID REFERENCES programa(id),
    creados INT NOT NULL DEFAULT 0,
    actualizados INT NOT NULL DEFAULT 0,
    omitidos INT NOT NULL DEFAULT 0,
    errores INT NOT NULL DEFAULT 0,
    detalle TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Recuperación de contraseña ──────────────────────────────────────────────
ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS reset_token VARCHAR(120),
    ADD COLUMN IF NOT EXISTS reset_token_expira TIMESTAMP;
