-- Identidad visual y plantilla de correo de cada programa.
--
-- Tabla aparte y no columnas en `programa` por dos motivos: son datos de
-- presentacion que cambian a otro ritmo que los del programa, y asi la fila
-- puede no existir, que es exactamente lo que significa "usa la gama global
-- del panel" sin necesidad de inventar valores por defecto en cada columna.
--
-- Las medidas se guardan junto a cada imagen porque el ancho y el alto que se
-- exigen al subirla son parte del contrato con el cliente de correo: sin
-- width/height en el HTML, Outlook estira las imagenes al tamano original.

CREATE TABLE programa_branding (
    programa_id UUID PRIMARY KEY REFERENCES programa (id) ON DELETE CASCADE,

    -- NULL = gama global del panel. Es el comportamiento por defecto y por eso
    -- se representa con la ausencia de valor, no con un blanco concreto.
    color_primario VARCHAR(7),

    -- Encabezado propio del panel.
    titulo_header VARCHAR(120),
    subtitulo_header VARCHAR(200),

    banner_panel_url TEXT,
    banner_panel_ancho INTEGER,
    banner_panel_alto INTEGER,

    -- Cabecera y pie del correo.
    correo_header_url TEXT,
    correo_header_ancho INTEGER,
    correo_header_alto INTEGER,
    correo_pie_url TEXT,
    correo_pie_ancho INTEGER,
    correo_pie_alto INTEGER,
    correo_texto_pie TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,

    -- Un color mal escrito rompe la interfaz entera de ese programa, y el
    -- sitio barato para descubrirlo es aqui y no en el navegador del usuario.
    CONSTRAINT color_primario_es_hex
        CHECK (color_primario IS NULL OR color_primario ~ '^#[0-9A-Fa-f]{6}$'),

    -- Una medida de cero o negativa no es una medida.
    CONSTRAINT medidas_positivas CHECK (
        (banner_panel_ancho IS NULL OR banner_panel_ancho > 0) AND
        (banner_panel_alto IS NULL OR banner_panel_alto > 0) AND
        (correo_header_ancho IS NULL OR correo_header_ancho > 0) AND
        (correo_header_alto IS NULL OR correo_header_alto > 0) AND
        (correo_pie_ancho IS NULL OR correo_pie_ancho > 0) AND
        (correo_pie_alto IS NULL OR correo_pie_alto > 0)
    )
);

COMMENT ON TABLE programa_branding IS
    'Identidad visual por programa. Si no hay fila, se usa la gama global del panel.';
COMMENT ON COLUMN programa_branding.color_primario IS
    'Hex #RRGGBB. NULL = gama global. De el se deriva la paleta armonica en el frontend.';
