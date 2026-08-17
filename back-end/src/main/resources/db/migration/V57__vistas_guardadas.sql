-- Vistas guardadas de las listas.
--
-- «Los activos de Nodo Academico sin colocar» es una consulta que alguien
-- reconstruye a mano cada lunes. Guardarla no es comodidad: mientras cada
-- persona arma la suya, dos coordinadores que dicen mirar lo mismo miran
-- conjuntos distintos, y las cifras que llevan a la reunion no cuadran.
--
-- Los filtros van como JSON y no como columnas a proposito. Cada modulo filtra
-- por cosas distintas —estudiantes por estado academico, vacantes por ciudad y
-- fuente— y una tabla con la union de todas las columnas seria mayormente
-- nulos, mas una migracion cada vez que alguien añade un filtro a una pantalla.
-- El precio es que la base no valida el contenido: una clave que se renombre en
-- el frontend deja de aplicarse en las vistas viejas. Se asume porque el peor
-- caso es una vista que filtra de menos, no datos mal escritos.

CREATE TABLE vista_guardada (
    id          UUID PRIMARY KEY,
    nombre      VARCHAR(120) NOT NULL,
    modulo      VARCHAR(30)  NOT NULL,
    filtros     TEXT         NOT NULL DEFAULT '{}',
    propietario VARCHAR(255) NOT NULL,
    -- Compartida: la ve todo el equipo, pero solo la edita quien la creo. Sin
    -- esa asimetria, la vista que el equipo usa a diario se la puede cambiar
    -- cualquiera sin que el resto se entere.
    compartida  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Un mismo nombre no puede repetirse dentro del mismo modulo y dueño: dos
-- «Sin colocar» en la misma lista obligan a abrirlas para saber cual es cual.
CREATE UNIQUE INDEX ux_vista_guardada_nombre
    ON vista_guardada (propietario, modulo, lower(nombre));

-- La consulta de cada pantalla: las mias mas las compartidas por otros.
CREATE INDEX idx_vista_guardada_modulo
    ON vista_guardada (modulo, propietario);

COMMENT ON COLUMN vista_guardada.filtros IS
    'JSON con los filtros aplicados. Las claves desconocidas se ignoran al cargar.';
