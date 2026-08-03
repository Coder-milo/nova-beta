-- Plantillas de correo editables desde el panel.
--
-- El HTML de la plantilla NO se guarda aqui: lo arma `PlantillaCorreo` con
-- tablas y estilos en linea, que es lo que Outlook entiende. Aqui va solo lo
-- que el coordinador escribe —asunto y cuerpo—, y al enviar se envuelve. Si se
-- guardara el HTML completo, cada arreglo de compatibilidad con un cliente de
-- correo habria que aplicarlo a mano en cada plantilla ya creada.

CREATE TABLE plantilla_correo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- NULL = plantilla comun a todos los proyectos. Es lo que permite tener una
    -- sola "bienvenida" y que cada programa la vista con su marca al enviarla.
    programa_id UUID REFERENCES programa (id) ON DELETE CASCADE,

    nombre VARCHAR(120) NOT NULL,
    descripcion VARCHAR(300),

    asunto VARCHAR(300) NOT NULL,
    -- Cuerpo en HTML sencillo (parrafos, negrita, enlaces). Lo envuelve
    -- PlantillaCorreo al enviar.
    cuerpo TEXT NOT NULL,

    -- Texto del boton y a donde va. Vacios = correo sin boton.
    boton_texto VARCHAR(80),
    boton_url VARCHAR(500),

    -- Quien puede usarla. Solo COORDINADOR y ADMIN existen como roles de
    -- gestion; no hay un "Coordinador Academico" aparte.
    rol_minimo VARCHAR(20) NOT NULL DEFAULT 'COORDINADOR',

    activa BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT rol_minimo_valido CHECK (rol_minimo IN ('COORDINADOR', 'ADMIN'))
);

-- Dos plantillas con el mismo nombre dentro del mismo proyecto se confunden al
-- elegir en un desplegable. El indice permite repetir el nombre entre proyectos
-- distintos, que es justo lo que se quiere.
CREATE UNIQUE INDEX idx_plantilla_nombre_por_programa
    ON plantilla_correo (COALESCE(programa_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));

CREATE INDEX idx_plantilla_programa_activa ON plantilla_correo (programa_id, activa);

COMMENT ON TABLE plantilla_correo IS
    'Asunto y cuerpo que escribe el coordinador. El HTML lo envuelve PlantillaCorreo al enviar.';
COMMENT ON COLUMN plantilla_correo.programa_id IS
    'NULL = comun a todos los proyectos; cada uno la envia con su propia marca.';
