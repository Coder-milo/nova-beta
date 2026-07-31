-- Canal de WhatsApp Cloud API (Meta) de cada programa.
--
-- Misma filosofia que programa_branding: tabla aparte y ausencia de fila =
-- "este programa no tiene WhatsApp configurado". El token de acceso se guarda
-- CIFRADO (AES-GCM con la clave WHATSAPP_TOKEN_KEY del entorno), nunca plano:
-- un respaldo de la base no debe dejar al negocio hablando por WhatsApp del
-- cliente.

CREATE TABLE programa_whatsapp (
    programa_id UUID PRIMARY KEY REFERENCES programa (id) ON DELETE CASCADE,

    -- Numero de negocio en formato E.164, con + y sin separadores. Es el numero
    -- desde el que responde el negocio y el destino de los avisos de prueba.
    numero_whatsapp VARCHAR(16),

    -- ID del telefono de negocio que entrega la API de Meta (waba_id + phone_id).
    phone_id VARCHAR(64),

    -- Token de acceso cifrado con AES-GCM. La forma exacta la define
    -- WhatsappCrypto; esto es una caja opaca para la base de datos.
    token_cifrado TEXT,

    activo BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    version BIGINT NOT NULL DEFAULT 0,

    -- Un token sin numero ni phone_id es un token inservible: si no hay canal
    -- al que llamar, la configuracion no puede estar completa.
    CONSTRAINT token_exige_canal CHECK (
        token_cifrado IS NULL OR (numero_whatsapp IS NOT NULL AND phone_id IS NOT NULL)
    ),

    -- El formato que la API exige en las llamadas. Un numero mal formado
    -- devuelve un error de Meta en el peor momento: al avisar a un postulante.
    CONSTRAINT whatsapp_numero_e164 CHECK (
        numero_whatsapp IS NULL OR numero_whatsapp ~ '^\+[1-9][0-9]{7,14}$'
    )
);

COMMENT ON TABLE programa_whatsapp IS
    'Configuracion de WhatsApp Cloud API por programa. Sin fila = canal no configurado.';
COMMENT ON COLUMN programa_whatsapp.token_cifrado IS
    'Token de acceso a la API de Meta, cifrado con AES-GCM. Nunca se devuelve al frontend.';
