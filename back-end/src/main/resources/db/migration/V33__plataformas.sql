-- Plataformas externas a las que el estudiante accede desde su portal.
--
-- Dos niveles de visibilidad, igual que hay dos piezas de la pantalla:
--   1. El catalogo dice QUE plataformas existen (nombre, enlace, imagen).
--      Lo administra el equipo desde Configuracion, y dura para toda la
--      instalacion —ninguna fila pertenece a un programa ni a un estudiante.
--   2. El programa activa cuales de esas plataformas le interesan a su
--      cohorte, y despues, dentro de ese subconjunto, el coordinador marca
--      cuales le tocan a cada estudiante.
--
-- Un estudiante no puede terminar con una plataforma que su programa no
-- ofrece: la pantalla del equipo se apoya en la misma consulta que el
-- enlace. La restriccion se mantiene en el servicio, no en la base, porque
-- la alternativa —un trigger que contraste programa contra
-- estudiante_plataforma— es maquina que nadie recuerda cuando cambia algo.

CREATE TABLE IF NOT EXISTS plataforma (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo      TEXT NOT NULL UNIQUE,
    nombre      TEXT NOT NULL,
    url         TEXT NOT NULL,
    icono_url   TEXT,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    -- Borrado suave: una plataforma en uso por asignaciones no se destruye,
    -- se desactiva. Cambiar el enlace o la imagen no toca ninguna asignacion.
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    version     BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_plataforma_activo ON plataforma (activo);

CREATE TABLE IF NOT EXISTS programa_plataforma (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    programa_id     UUID NOT NULL REFERENCES programa (id) ON DELETE CASCADE,
    plataforma_id   UUID NOT NULL REFERENCES plataforma (id) ON DELETE CASCADE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    version         BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_programa_plataforma UNIQUE (programa_id, plataforma_id)
);

CREATE TABLE IF NOT EXISTS estudiante_plataforma (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id   UUID NOT NULL REFERENCES estudiante (id) ON DELETE CASCADE,
    plataforma_id   UUID NOT NULL REFERENCES plataforma (id) ON DELETE CASCADE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    version         BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_estudiante_plataforma UNIQUE (estudiante_id, plataforma_id)
);

-- Catálogo inicial. Idempotente: si el equipo ya renombró o corrigió un
-- enlace, el ignore deja su edición intacta y solo incorpora lo que falte.
INSERT INTO plataforma (codigo, nombre, url, icono_url, activo)
VALUES
    ('ELL', 'ELL Technologies', 'https://learn.elltechnologies.com/login',
     'https://s3.amazonaws.com/ell-serenity-data/images/ell_logo_favicon.png', TRUE),
    ('PEARSON', 'Pearson English',
     'https://login.pearson.com/v1/piapi/iesui/signin?client_id=bWPoUiRnLpUhX2r0hGeP4AaLCeyWYNYDA&login_success_url=https:%2F%2Fenglish-dashboard.pearson.com%2Fies-session%3FiesCode%3DQeICj5e5kb',
     'https://english-dashboard.pearson.com/dashboard/src/favicon.ico', TRUE),
    ('Q10', 'Q10',
     'https://site6.q10.com/login?aplentId=7d1c0ba4-05fe-4814-a3A4-0297655133a4',
     'https://site6.q10.com/favicon_q10.ico', TRUE),
    ('TESTHUB', 'Pearson Test Hub',
     'https://login.pearson.com/v1/piapi/iesui/signin?client_id=GmYaPeX9S71W89Xpw64N0N88GGXxA1ph&login_success_url=https:%2F%2Fenglish-testhub.pearson.com%2Fies-session%3FiesCode%3DaPzNSqSF2P',
     'https://english-testhub.pearson.com/favicon.png', TRUE)
ON CONFLICT (codigo) DO NOTHING;