-- Cuantas ofertas trajo cada portal en cada corrida.
--
-- La tabla guardaba `vacantes_nuevas`, que son las que se grabaron despues de
-- deduplicar. Con ese numero solo, una corrida de "0 nuevas y sin errores" es
-- indistinguible entre dos casos que no se parecen en nada:
--
--   * los portales trajeron 40 ofertas y todas ya estaban  -> sano
--   * los portales trajeron 0 porque les cambiaron el HTML  -> roto
--
-- Y un portal roto no falla: responde 200 y devuelve cero. Asi estuvo Elempleo
-- muerto sin que nadie lo notara. El conteo por portal es lo que lo delata,
-- porque el sintoma es "REMOTIVE 12, JSEARCH 0, ELEMPLEO 0" repetido varios
-- dias, no una cifra suelta.
--
-- Formato `PORTAL=n;PORTAL=n`, no una tabla aparte ni JSON. Son tres o cuatro
-- pares por fila, solo se leen para pintarlos y nunca se consultan por su
-- contenido: una tabla hija obligaria a un join en la unica consulta que hay, y
-- jsonb, a un tipo que ninguna otra columna del esquema usa.
ALTER TABLE scraping_ejecucion
    ADD COLUMN ofertas_por_portal TEXT;

-- Nullable a proposito: las corridas anteriores a esta columna no lo tienen y
-- no se puede inventar. Un 0 por defecto diria que aquellas corridas no
-- trajeron nada, que es justo la afirmacion que no se puede hacer. El panel
-- distingue "no se registro" de "cero".
COMMENT ON COLUMN scraping_ejecucion.ofertas_por_portal IS
    'Ofertas devueltas por cada portal, antes de deduplicar. Formato PORTAL=n;PORTAL=n. Nulo en las corridas anteriores a la columna.';
