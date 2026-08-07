-- Texto comparable: sin tildes, sin mayusculas y sin signos.
--
-- La busqueda de estudiantes comparaba con LOWER(), asi que "Jose" no
-- encontraba a "José" y "PEREZ" no encontraba a "Pérez". Lo mismo pasaba al
-- importar: un mismo participante escrito con tilde en un archivo y sin ella
-- en el siguiente entraba dos veces, porque la busqueda de duplicados usaba
-- igualdad exacta.
--
-- Se resuelve con translate() y no con la extension unaccent a proposito: una
-- extension hay que poder crearla en cada entorno donde se despliegue, y si el
-- usuario de la base no tiene permiso la migracion falla y tumba el despliegue.
-- translate() es SQL a secas, se comporta igual en todas partes y es IMMUTABLE,
-- de modo que sirve para indexar el dia que estos volumenes lo pidan.
--
-- Los signos se convierten en espacio y no se borran: "Perez-Gomez" tiene que
-- comparar igual que "Perez Gomez", y borrarlos daria "perezgomez", que no
-- coincide con ninguna de las dos.
CREATE OR REPLACE FUNCTION novacrm_normalizar(texto TEXT)
RETURNS TEXT AS $$
    SELECT NULLIF(
        BTRIM(
            regexp_replace(
                regexp_replace(
                    translate(
                        lower(COALESCE(texto, '')),
                        'áàäâãéèëêíìïîóòöôõúùüûñç',
                        'aaaaaeeeeiiiiooooouuuunc'
                    ),
                    '[^a-z0-9]+', ' ', 'g'
                ),
                '\s+', ' ', 'g'
            )
        ),
        ''
    );
$$ LANGUAGE SQL IMMUTABLE;

COMMENT ON FUNCTION novacrm_normalizar(TEXT) IS
    'Texto comparable para busqueda y deduplicacion: minusculas, sin tildes, signos como espacio.';
