-- Las otras dos reglas de comparacion, hermanas de novacrm_normalizar (V38).
--
-- Van en su propia migracion y no dentro de la V38 porque esa ya se aplico:
-- reescribirla cambiaria su checksum y volveria a romper la validacion de
-- Flyway, que es justo el problema del que se acaba de salir.
--
-- Son tres y no una porque el mismo signo significa cosas distintas segun lo
-- que se compare, y meterlas en una sola funcion obligaria a elegir una
-- interpretacion y equivocarse en los otros dos casos.

-- Razon social: el punto y el espacio son ruido de escritura.
--
-- Con la regla de las personas «Solvo S.A.S.» daba "solvo s a s" y «SOLVO SAS»
-- daba "solvo sas": dos empleadores donde hay uno. Quitando tambien los
-- espacios, las dos caen en "solvosas".
CREATE OR REPLACE FUNCTION novacrm_normalizar_empresa(texto TEXT)
RETURNS TEXT AS $$
    SELECT NULLIF(replace(COALESCE(novacrm_normalizar(texto), ''), ' ', ''), '');
$$ LANGUAGE SQL IMMUTABLE;

-- Documento de identidad: los signos se van del todo, no se vuelven espacio.
--
-- Llega de Excel como "1.234.567" y se busca "1234567". Convertir los puntos en
-- espacio daria "1 234 567", que no compara con ninguna de las dos formas.
CREATE OR REPLACE FUNCTION novacrm_solo_alfanumerico(texto TEXT)
RETURNS TEXT AS $$
    SELECT NULLIF(lower(regexp_replace(COALESCE(texto, ''), '[^0-9A-Za-z]', '', 'g')), '');
$$ LANGUAGE SQL IMMUTABLE;

COMMENT ON FUNCTION novacrm_normalizar_empresa(TEXT) IS
    'Clave de comparacion para razones sociales: sin tildes, sin signos y sin espacios.';
COMMENT ON FUNCTION novacrm_solo_alfanumerico(TEXT) IS
    'Clave de comparacion para documentos de identidad: solo letras y digitos, en minusculas.';
