-- Bandeja de mensajes de WhatsApp: lo que los estudiantes escriben al numero
-- del negocio y los avisos que el sistema les envia. Alimenta la conversacion
-- que el coordinador ve en el panel.

CREATE TABLE mensaje_whatsapp (
    id UUID PRIMARY KEY,

    -- Programa al que pertenece el mensaje. Nulo si el remitente no se pudo
    -- emparejar con ningun estudiante; esos mensajes no aparecen en ninguna
    -- bandeja.
    programa_id UUID REFERENCES programa (id) ON DELETE CASCADE,

    -- Estudiante al que corresponde. Nulo si el remitente es desconocido; no
    -- se borra con el estudiante para conservar el rastro de la conversacion.
    estudiante_id UUID REFERENCES estudiante (id) ON DELETE SET NULL,

    -- Celular del otro extremo en E.164: el del estudiante en los entrantes,
    -- el del negocio en los salientes.
    remitente VARCHAR(16) NOT NULL,

    -- ENTRANTE: escribio un estudiante. SALIENTE: aviso del sistema.
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ENTRANTE', 'SALIENTE')),

    texto TEXT NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- La bandeja es una conversacion por programa, ordenada por fecha.
CREATE INDEX idx_mensaje_whatsapp_programa
    ON mensaje_whatsapp (programa_id, created_at DESC);

COMMENT ON TABLE mensaje_whatsapp IS
    'Mensajes de WhatsApp entrantes y salientes de cada programa.';
