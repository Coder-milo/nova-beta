-- Fuentes de vacantes segmentadas, control de cupo y deduplicacion firme.
--
-- Tres cosas que iban juntas:
--
-- 1. `segmento` en la vacante. La unica fuente activa era Remotive —remoto, en
--    ingles, sesgado a tecnologia— y sus ofertas se le recomendaban por igual a
--    los 107 participantes, incluyendo a quien no tiene computador propio. Con
--    el segmento cada oferta llega solo a quien puede tomarla.
--
-- 2. `cuota_fuente`. JSearch da 200 peticiones al mes y el proceso se reinicia
--    en cada despliegue, asi que contar en memoria no sirve.
--
-- 3. Indice unico en `hash_dedup`. La deduplicacion era una carrera
--    leer-y-luego-escribir entre el cron y el boton del panel.

ALTER TABLE vacante
    ADD COLUMN IF NOT EXISTS segmento VARCHAR(20);

COMMENT ON COLUMN vacante.segmento IS
    'LOCAL_COLOMBIA | REMOTO_INGLES | MIGRACION. NULL en las registradas a mano y en las anteriores a esta migracion: no hay con que deducirlo, y suponerlo mandaria ofertas a quien no puede tomarlas.';

CREATE TABLE IF NOT EXISTS cuota_fuente (
    id          UUID PRIMARY KEY,
    fuente      VARCHAR(40) NOT NULL,
    periodo     VARCHAR(7)  NOT NULL,
    consumidas  INTEGER     NOT NULL DEFAULT 0,
    limite      INTEGER     NOT NULL,
    created_at  TIMESTAMP   NOT NULL,
    updated_at  TIMESTAMP   NOT NULL,
    version     BIGINT,
    CONSTRAINT uk_cuota_fuente_periodo UNIQUE (fuente, periodo)
);

-- Los duplicados que dejo la carrera impiden crear el indice, asi que hay que
-- resolverlos antes. Se le quita el hash a los repetidos en vez de borrarlos:
-- una vacante duplicada puede tener ya matches y postulaciones colgando, y
-- borrarla se llevaria por delante el historial de alguien —o fallaria contra
-- la clave foranea a mitad de la migracion—. Sin hash quedan fuera del indice
-- (en Postgres varios NULL no chocan) y dejan de participar en la
-- deduplicacion, que es exactamente lo que corresponde a una fila que ya esta
-- repetida. Conserva el hash la mas antigua de cada grupo.
UPDATE vacante SET hash_dedup = NULL
WHERE hash_dedup IS NOT NULL
  AND id NOT IN (
      SELECT DISTINCT ON (hash_dedup) id
      FROM vacante
      WHERE hash_dedup IS NOT NULL
      ORDER BY hash_dedup, created_at, id
  );

CREATE UNIQUE INDEX IF NOT EXISTS uk_vacante_hash_dedup
    ON vacante (hash_dedup)
    WHERE hash_dedup IS NOT NULL;
