-- El analisis de una previsualizacion, guardado hasta que se confirme.
--
-- Previsualizar y confirmar son dos peticiones, y la segunda volvia a analizar
-- el archivo desde cero. Mientras el reconocimiento de columnas era un
-- diccionario eso daba siempre lo mismo y nadie lo noto. Desde que se apoya en
-- la IA ya no: la misma cabecera puede recibir otro campo, el presupuesto de
-- consultas puede acabarse en otro punto o el proveedor puede no contestar. Lo
-- que se revisaba y lo que se escribia habian dejado de ser lo mismo.
--
-- Aqui se guarda el analisis y su identificador viaja a la pantalla; al
-- confirmar vuelve y se aplica tal cual, sin volver a consultar a la IA.
--
-- En la base y no en memoria porque entre las dos pantallas puede pasar de
-- todo —el turno de quien carga, un redespliegue— y perder el plan obliga a
-- repetir el analisis, que es justo lo que se queria evitar.

CREATE TABLE plan_de_importacion (
    id         UUID PRIMARY KEY,
    -- SHA-256 del contenido, no el nombre: un archivo corregido entre las dos
    -- pantallas conserva el nombre y ya no dice lo que decia. Aplicarle el plan
    -- de la version anterior escribiria columnas cambiadas de sitio.
    --
    -- VARCHAR y no CHAR aunque los 64 caracteres sean fijos. CHAR(n) en
    -- PostgreSQL es `bpchar`, rellena con espacios a la derecha y no le gana
    -- nada en rendimiento a VARCHAR; ademas Hibernate valida la columna como
    -- varchar y se niega a arrancar contra un bpchar.
    huella     VARCHAR(64)  NOT NULL,
    archivo    VARCHAR(255) NOT NULL,
    -- Un plan solo lo ejecuta quien lo creo. No es tanto por seguridad —hace
    -- falta el archivo entero para que la huella cuadre— como porque el
    -- historial tiene que poder decir quien aprobo que.
    usuario    VARCHAR(255) NOT NULL,
    analisis   TEXT         NOT NULL,
    expira_en  TIMESTAMP    NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    -- El bloqueo optimista que declara BaseEntity. Se escribe aqui y no en una
    -- migracion posterior porque olvidarlo es lo que dejo `vista_guardada` sin
    -- arrancar contra el esquema real: los tests usan H2 con el esquema
    -- generado por Hibernate, asi que una migracion incompleta pasa
    -- desapercibida hasta produccion.
    version    BIGINT       NOT NULL DEFAULT 0
);

-- La unica consulta de mantenimiento: borrar lo que ya caduco.
CREATE INDEX idx_plan_de_importacion_expira ON plan_de_importacion (expira_en);

COMMENT ON COLUMN plan_de_importacion.analisis IS
    'JSON con el destino de cada hoja, su fila de cabecera y el campo de cada columna.';
