-- Descarte de un match sin borrar la fila.
--
-- Hasta ahora descartar hacia DELETE. El boton "No, gracias" de la plantilla de
-- WhatsApp es la etiqueta negativa mas limpia que recibe el sistema —la persona
-- miro la vacante y dijo que no— y se destruia al llegar. Sin negativos no hay
-- forma de medir si un puntaje alto predice una respuesta positiva, que es
-- justo para lo que se empezo a guardar el desglose en V28.
--
-- Efecto secundario util: el par queda registrado, asi que la corrida siguiente
-- no vuelve a proponer lo que ya se rechazo.

ALTER TABLE match_resultado
    ADD COLUMN IF NOT EXISTS descartado     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS descartado_en  TIMESTAMP,
    ADD COLUMN IF NOT EXISTS descartado_por VARCHAR(120);

COMMENT ON COLUMN match_resultado.descartado_por IS
    'Quien lo descarto: "WhatsApp" cuando lo hizo el estudiante desde la plantilla, si no el usuario del panel.';

-- La lista de recomendaciones del estudiante filtra por descartado y por
-- vigencia de la vacante; sin esto es un recorrido de todos sus matches.
CREATE INDEX IF NOT EXISTS idx_match_estudiante_vivo
    ON match_resultado (estudiante_id, puntaje DESC)
    WHERE descartado = FALSE;
