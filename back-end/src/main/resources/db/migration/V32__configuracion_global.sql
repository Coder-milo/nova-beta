-- Configuracion global del CRM: identidad de la institucion y los dos
-- parametros de operacion que hoy decide el equipo.
--
-- Vivia en `localStorage` bajo las claves `nova_inst_config` y
-- `nova_acad_config`. Eso significaba que cada navegador tenia su propia
-- version de los datos de la institucion, que se perdian al limpiar la cache y
-- que el coordinador y el administrador podian estar mirando NIT distintos sin
-- que ninguno de los dos lo supiera. La pantalla lo admitia al guardar
-- —«guardado en este navegador»—, pero seguia siendo el unico sitio donde
-- escribir esos datos.
--
-- Peor era el umbral de match: la pantalla ofrecia editarlo y arrancaba en 70,
-- mientras el motor cortaba por el 55 de `matching-config.yml`. No es que el
-- valor no se guardara: es que el numero que se enseñaba nunca fue el que
-- decidia a quien se le recomienda una vacante. Ahora la columna manda y el
-- YAML pasa a ser solo el valor de partida.
--
-- Fila unica por diseño: es la configuracion de la instalacion, no de un
-- programa ni de un usuario. La restriccion `id = 1` lo sostiene en la base en
-- vez de confiarlo a que el servicio nunca se equivoque; una segunda fila
-- significaria dos configuraciones compitiendo y ninguna forma de saber cual
-- gana.

CREATE TABLE IF NOT EXISTS configuracion_global (
    id                      INTEGER   PRIMARY KEY,

    -- Identidad institucional. TEXT y no VARCHAR(n) por lo mismo que V31: son
    -- campos que rellena una persona a mano y un limite corto solo se descubre
    -- cuando alguien pierde lo que acababa de escribir.
    nombre_oficial          TEXT,
    nit                     TEXT,
    registro_educativo      TEXT,
    sede_principal          TEXT,
    telefono_contacto       TEXT,
    whatsapp_soporte        TEXT,
    email_contacto          TEXT,
    email_soporte           TEXT,
    sitio_web               TEXT,
    linkedin_url            TEXT,
    instagram_url           TEXT,

    -- Operacion.
    cohorte_activa          TEXT,
    umbral_match_minimo     INTEGER,
    dias_retencion_papelera INTEGER,

    created_at              TIMESTAMP NOT NULL,
    updated_at              TIMESTAMP NOT NULL,
    version                 BIGINT,

    CONSTRAINT ck_configuracion_global_fila_unica
        CHECK (id = 1),
    CONSTRAINT ck_configuracion_global_umbral
        CHECK (umbral_match_minimo IS NULL OR umbral_match_minimo BETWEEN 0 AND 100),
    CONSTRAINT ck_configuracion_global_retencion
        CHECK (dias_retencion_papelera IS NULL OR dias_retencion_papelera BETWEEN 1 AND 365)
);

COMMENT ON TABLE configuracion_global IS
    'Una sola fila (id = 1). Configuracion de la instalacion, no de un programa.';

COMMENT ON COLUMN configuracion_global.umbral_match_minimo IS
    'Puntaje minimo para que un par estudiante-vacante llegue a ser match. NULL = usar el umbral_minimo de matching-config.yml.';

COMMENT ON COLUMN configuracion_global.dias_retencion_papelera IS
    'Dias que una ficha desactivada aguanta en la papelera antes de que la purga la borre fisicamente. NULL = 30.';

-- La fila no se crea aqui. Sin datos, `obtener()` responde los valores por
-- defecto y la pantalla sale vacia con sus marcadores de posicion: es la
-- verdad —nadie ha guardado nada todavia— y evita sembrar un NIT y una
-- resolucion de ejemplo que en la base parecerian datos reales de la
-- institucion.
