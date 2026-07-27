-- ============================================================
-- Cierre de vacantes y registro de actualizaciones
--
-- Una vacante dejaba de mostrarse solo si alguien ponia activo=false a mano.
-- La columna fecha_expiracion existia desde V1 y no la leia ninguna consulta,
-- asi que las ofertas vencidas seguian recomendandose y los estudiantes se
-- postulaban a plazas ya cubiertas.
-- ============================================================

ALTER TABLE vacante
    ADD COLUMN IF NOT EXISTS motivo_cierre VARCHAR(30),
    ADD COLUMN IF NOT EXISTS fecha_cierre  TIMESTAMP,
    ADD COLUMN IF NOT EXISTS creada_por    VARCHAR(255);

COMMENT ON COLUMN vacante.motivo_cierre IS
    'EXPIRADA (paso su fecha), CUBIERTA (ya encontraron personal), RETIRADA (la quito el portal o el coordinador)';

-- El matching recorre las vacantes vigentes en cada pasada.
CREATE INDEX IF NOT EXISTS idx_vacante_vigencia
    ON vacante (activo, fecha_expiracion);

-- Deja fuera de la vista las que ya vencieron antes de este cambio.
UPDATE vacante
SET activo        = FALSE,
    motivo_cierre = 'EXPIRADA',
    fecha_cierre  = fecha_expiracion
WHERE activo = TRUE
  AND fecha_expiracion IS NOT NULL
  AND fecha_expiracion < NOW();

-- ============================================================
-- Historial de actualizaciones de vacantes
--
-- Permite responder "cuantas ofertas entraron en la ultima actualizacion",
-- que es lo que se muestra en el aviso del panel.
-- ============================================================

CREATE TABLE IF NOT EXISTS scraping_ejecucion (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inicio            TIMESTAMP NOT NULL,
    fin               TIMESTAMP,
    vacantes_nuevas   INT       NOT NULL DEFAULT 0,
    vacantes_cerradas INT       NOT NULL DEFAULT 0,
    portales          VARCHAR(255),
    origen            VARCHAR(20) NOT NULL DEFAULT 'PROGRAMADA',
    error             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    version           BIGINT    NOT NULL DEFAULT 0
);

COMMENT ON COLUMN scraping_ejecucion.origen IS 'PROGRAMADA (tarea diaria) o MANUAL (boton del panel)';

CREATE INDEX IF NOT EXISTS idx_scraping_ejecucion_inicio
    ON scraping_ejecucion (inicio DESC);
