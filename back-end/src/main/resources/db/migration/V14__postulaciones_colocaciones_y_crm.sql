-- ============================================================
-- Lo que el CRM no sabia y la hoja de calculo si
--
-- El equipo seguia llevando en Excel cuatro cosas que aqui no tenian sitio:
--   1. El estado de cada postulacion (no de cada estudiante).
--   2. La colocacion laboral con salario, canal y checklist de ingreso.
--   3. La relacion con cada empresa: a quien se le escribio y que contesto.
--   4. Los hitos de preparacion, que no son booleanos sino de tres estados.
--
-- Mientras eso viviera solo en la hoja, el CRM no podia sustituirla y el
-- indicador que se le reporta al financiador —cuanta gente se coloco y por
-- encima de que salario— salia de un archivo que nadie valida.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Postulaciones
--
-- Una fila por postulacion, no por estudiante. Match.postulado era un booleano
-- y no permitia que la misma persona tuviera cinco procesos abiertos en
-- estados distintos, que es exactamente lo que ocurre.
--
-- vacante_id es opcional a proposito: muchas postulaciones salen de una feria,
-- de un contacto directo o de una oferta que el estudiante encontro por su
-- cuenta, y exigir una vacante registrada obligaria a inventarla.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS postulacion (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id      UUID NOT NULL REFERENCES estudiante (id) ON DELETE CASCADE,
    vacante_id         UUID REFERENCES vacante (id) ON DELETE SET NULL,
    empresa_id         UUID REFERENCES empresa (id) ON DELETE SET NULL,
    -- Nombre y cargo en texto: la postulacion sobrevive a que la vacante se
    -- borre o a que la empresa nunca se diera de alta.
    empresa_nombre     VARCHAR(255) NOT NULL,
    cargo              VARCHAR(255) NOT NULL,
    canal              VARCHAR(60),
    fecha_postulacion  DATE NOT NULL,
    estado             VARCHAR(30) NOT NULL DEFAULT 'ENVIADA',
    fecha_respuesta    DATE,
    resultado          TEXT,
    observaciones      TEXT,
    -- Quien la lleva. El estudiante puede actualizar la suya desde su cuenta.
    gestionada_por     VARCHAR(255),
    registrada_por_estudiante BOOLEAN NOT NULL DEFAULT FALSE,
    url_oferta         VARCHAR(1000),
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    version            BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_postulacion_estudiante
    ON postulacion (estudiante_id, fecha_postulacion DESC);
CREATE INDEX IF NOT EXISTS idx_postulacion_estado
    ON postulacion (estado);
CREATE INDEX IF NOT EXISTS idx_postulacion_empresa
    ON postulacion (empresa_id);

-- La misma persona no se postula dos veces a la misma vacante. Sin esto, un
-- doble clic en "postularme" deja dos procesos que despues nadie sabe cerrar.
CREATE UNIQUE INDEX IF NOT EXISTS uk_postulacion_estudiante_vacante
    ON postulacion (estudiante_id, vacante_id)
    WHERE vacante_id IS NOT NULL;

COMMENT ON COLUMN postulacion.estado IS
    'ENVIADA, EN_PROCESO, ENTREVISTA_AGENDADA, ENTREVISTA_REALIZADA, RECHAZADO, CONTRATADO, SIN_RESPUESTA';

-- ------------------------------------------------------------
-- 2. Colocaciones
--
-- El dato que se reporta. Antes solo existia EstadoEmpleabilidad.EMPLEADO, un
-- enum de tres valores sin nada detras: ni empresa, ni salario, ni desde
-- cuando, ni si lo consiguio el programa o la persona por su cuenta.
--
-- La diferencia contra la meta salarial NO se guarda: se calcula. La meta es
-- configuracion (app.colocacion.meta-salarial) y guardar la resta dejaria
-- filas que mienten en cuanto la meta cambie.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS colocacion (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estudiante_id      UUID NOT NULL REFERENCES estudiante (id) ON DELETE CASCADE,
    postulacion_id     UUID REFERENCES postulacion (id) ON DELETE SET NULL,
    empresa_id         UUID REFERENCES empresa (id) ON DELETE SET NULL,
    empresa_nombre     VARCHAR(255) NOT NULL,
    cargo              VARCHAR(255),
    tipo_vinculacion   VARCHAR(30) NOT NULL DEFAULT 'EMPLEADO',
    fecha_inicio       DATE,
    -- A quien se le atribuye la colocacion. Sin esto no se puede distinguir lo
    -- que logro el programa de lo que la persona consiguio sola, que es la
    -- pregunta que hace el financiador.
    canal_consecucion  VARCHAR(40),
    salario            NUMERIC(12, 2),
    bonificaciones     VARCHAR(255),
    modalidad          VARCHAR(40),
    tipo_contrato      VARCHAR(60),
    -- Checklist de ingreso. NULL = sin revisar, distinto de FALSE = revisado y
    -- no cumple. Colapsarlos a booleano borraria la diferencia entre "falta
    -- mirarlo" y "lo miramos y no esta".
    chk_contrato             BOOLEAN,
    chk_verificacion_vacante BOOLEAN,
    chk_benchmark            BOOLEAN,
    chk_reglamento_interno   BOOLEAN,
    chk_colilla_pago         BOOLEAN,
    observaciones      TEXT,
    activa             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    version            BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_colocacion_estudiante
    ON colocacion (estudiante_id, activa);
CREATE INDEX IF NOT EXISTS idx_colocacion_fecha
    ON colocacion (fecha_inicio);

COMMENT ON COLUMN colocacion.canal_consecucion IS
    'OPEN_HOUSE, VISITA_CAC, FERIA, AUTOGESTIONADO, PORTAL, LINKEDIN, ALIADO, OTRO';

-- ------------------------------------------------------------
-- 3. Empresa como CRM
--
-- La tabla existia como catalogo colgado de vacante: nombre, sector y poco
-- mas. No guardaba a quien se le escribio, cuando, ni en que quedo, que es lo
-- unico que hace falta para no volver a tocar la misma puerta dos veces.
--
-- Los contadores del Excel (participantes enviados, respuestas, contratados)
-- no se replican como columnas: en la hoja decian "104" para todas las filas
-- porque nadie los actualizaba. Se calculan desde postulacion y colocacion.
-- ------------------------------------------------------------
ALTER TABLE empresa
    ADD COLUMN IF NOT EXISTS contacto_nombre       VARCHAR(255),
    ADD COLUMN IF NOT EXISTS contacto_email        VARCHAR(255),
    ADD COLUMN IF NOT EXISTS contacto_canal        VARCHAR(255),
    ADD COLUMN IF NOT EXISTS fecha_primer_contacto DATE,
    ADD COLUMN IF NOT EXISTS estado_relacion       VARCHAR(30) NOT NULL DEFAULT 'SIN_CONTACTAR',
    ADD COLUMN IF NOT EXISTS proximo_paso          TEXT,
    ADD COLUMN IF NOT EXISTS notas                 TEXT,
    ADD COLUMN IF NOT EXISTS cargos_tipicos        TEXT,
    ADD COLUMN IF NOT EXISTS canal_postulacion     VARCHAR(255),
    ADD COLUMN IF NOT EXISTS ciudad                VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_empresa_estado_relacion
    ON empresa (estado_relacion);

COMMENT ON COLUMN empresa.estado_relacion IS
    'SIN_CONTACTAR, CONTACTADA, PERFIL_ENVIADO, EN_CONVERSACION, ALIADA, DESCARTADA';

-- ------------------------------------------------------------
-- 4. Hitos de preparacion, de tres estados
--
-- El pipeline deducia la preparacion de tres booleanos, y uno de ellos era
-- falso: linkedin_optimizado salia de tener linkedin_user_id, es decir de
-- haber creado el perfil. En la hoja son 74 creados frente a 9 optimizados: el
-- CRM reportaba 74 donde el programa reporta 9.
--
-- Y no son booleanos. "En proceso" es un estado real —hay 14 perfiles
-- ocupacionales en el— y colapsarlo a false o a true falsea el indicador en
-- las dos direcciones.
-- ------------------------------------------------------------
ALTER TABLE estudiante
    ADD COLUMN IF NOT EXISTS hito_cv_listo            VARCHAR(15) NOT NULL DEFAULT 'NO',
    ADD COLUMN IF NOT EXISTS hito_cv_ingles           VARCHAR(15) NOT NULL DEFAULT 'NO',
    ADD COLUMN IF NOT EXISTS hito_linkedin_creado     VARCHAR(15) NOT NULL DEFAULT 'NO',
    ADD COLUMN IF NOT EXISTS hito_linkedin_optimizado VARCHAR(15) NOT NULL DEFAULT 'NO',
    ADD COLUMN IF NOT EXISTS hito_perfil_ocupacional  VARCHAR(15) NOT NULL DEFAULT 'NO';

COMMENT ON COLUMN estudiante.hito_cv_listo IS 'NO, EN_PROCESO o SI';

-- Quien ya tenia LinkedIn vinculado tiene el perfil creado; que este
-- optimizado es otra cosa y se captura a mano.
UPDATE estudiante
SET hito_linkedin_creado = 'SI'
WHERE linkedin_user_id IS NOT NULL
  AND hito_linkedin_creado = 'NO';

-- ------------------------------------------------------------
-- 5. Campos del participante que solo estaban en la hoja
--
-- La edad se guarda como fecha de nacimiento porque una edad guardada tal cual
-- deja de ser cierta al año siguiente. Como de la hoja solo se puede importar
-- la edad, se conserva junto a la fecha en que se capturo para poder
-- envejecerla; en cuanto haya fecha de nacimiento, manda esa.
-- ------------------------------------------------------------
ALTER TABLE estudiante
    ADD COLUMN IF NOT EXISTS fecha_nacimiento     DATE,
    ADD COLUMN IF NOT EXISTS edad_al_registrar    INTEGER,
    ADD COLUMN IF NOT EXISTS fecha_captura_edad   DATE,
    -- Carpeta de Drive del participante y perfil publico de LinkedIn: los dos
    -- enlaces que el equipo abre a diario y que no tenian donde vivir.
    ADD COLUMN IF NOT EXISTS carpeta_url          VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS linkedin_url         VARCHAR(1000);

-- ------------------------------------------------------------
-- 6. Ofertas registradas a mano
--
-- Una oferta que llega por una feria o por un contacto no tiene enlace, y
-- url_origen era obligatorio de facto. Ademas la jornada (tiempo completo,
-- medio tiempo) no cabia en tipo_contrato, que es otra cosa.
--
-- revisada separa lo que entra al matching: una oferta que registra un
-- estudiante es util, pero no debe recomendarsele a los otros 106 hasta que
-- alguien del equipo la mire.
-- ------------------------------------------------------------
ALTER TABLE vacante
    ADD COLUMN IF NOT EXISTS jornada  VARCHAR(40),
    ADD COLUMN IF NOT EXISTS ciudad   VARCHAR(255),
    ADD COLUMN IF NOT EXISTS revisada BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN vacante.revisada IS
    'Falso solo para ofertas registradas por un estudiante y aun sin validar; el matching las ignora';

-- Lo ya cargado viene de portales o del coordinador: cuenta como revisado.
UPDATE vacante SET revisada = TRUE WHERE revisada IS NULL;
