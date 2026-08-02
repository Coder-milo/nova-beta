-- Desglose del puntaje de matching.
--
-- Hasta ahora de cada match solo sobrevivia el escalar `puntaje`, asi que no
-- habia forma de explicar por que se recomendo una vacante ni de comparar dos
-- puntajes calculados con pesos distintos. Se guarda cada criterio de 0 a 1
-- (NULL = no se pudo evaluar), la cobertura de datos que respaldaba el puntaje,
-- y los pesos con los que se calculo.
--
-- Todas las columnas son NULL: los matches ya existentes se quedan sin desglose
-- porque se calcularon antes de que existiera, y eso es informacion legitima
-- —no habia con que rellenarlas—.

ALTER TABLE match_resultado
    ADD COLUMN IF NOT EXISTS puntaje_afinidad    NUMERIC(5,4),
    ADD COLUMN IF NOT EXISTS puntaje_habilidades NUMERIC(5,4),
    ADD COLUMN IF NOT EXISTS puntaje_ingles      NUMERIC(5,4),
    ADD COLUMN IF NOT EXISTS puntaje_ubicacion   NUMERIC(5,4),
    ADD COLUMN IF NOT EXISTS puntaje_experiencia NUMERIC(5,4),
    ADD COLUMN IF NOT EXISTS cobertura           NUMERIC(5,4),
    ADD COLUMN IF NOT EXISTS config_version      VARCHAR(80);

COMMENT ON COLUMN match_resultado.cobertura IS
    'Fraccion del peso total (0..1) que tenia datos reales al puntuar. Un puntaje alto con cobertura baja se apoya en muy poca evidencia.';
COMMENT ON COLUMN match_resultado.config_version IS
    'Pesos y umbral vigentes al calcular, para que el puntaje siga siendo interpretable tras reajustar matching-config.yml.';
