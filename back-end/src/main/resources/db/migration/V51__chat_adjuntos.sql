-- Adjuntos del chat entre estudiantes.
--
-- La pantalla ya dejaba adjuntar archivos: boton, lista debajo del campo de
-- texto y boton de enviar habilitado. Pero el envio mandaba solo texto y al
-- terminar limpiaba los adjuntos, asi que el archivo desaparecia sin que nada
-- lo dijera. Esta tabla es lo que faltaba detras.
--
-- Cuelga del mensaje y no de la conversacion: un adjunto sin su mensaje no
-- significa nada, y borrar el mensaje tiene que llevarselo. Por eso CASCADE, y
-- por eso el borrado del estudiante tambien lo alcanza (V23 puso CASCADE de
-- chat_directo_mensaje a estudiante).
CREATE TABLE chat_adjunto (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT,
    mensaje_id UUID NOT NULL REFERENCES chat_directo_mensaje(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    object_key TEXT NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    tamano BIGINT NOT NULL,
    -- Duracion en segundos de una nota de voz. Nula en lo que no es audio.
    -- Se guarda porque la pantalla la pinta antes de descargar el archivo:
    -- sacarla del propio audio obligaria a bajarlo entero para saber si dura
    -- tres segundos o dos minutos.
    duracion_segundos INT
);

CREATE INDEX idx_chat_adjunto_mensaje ON chat_adjunto(mensaje_id);
