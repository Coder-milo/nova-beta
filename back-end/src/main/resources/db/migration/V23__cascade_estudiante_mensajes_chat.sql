-- El borrado de estudiantes (papelera, reset de programa) chocaba con estas
-- dos FK sin CASCADE y hacia rollback de toda la operacion con un 500. Un
-- mensaje o un chat no sobreviven a su dueno: la conversacion se va con el.
ALTER TABLE mensaje_estudiante
    DROP CONSTRAINT IF EXISTS mensaje_estudiante_estudiante_id_fkey,
    ADD CONSTRAINT mensaje_estudiante_estudiante_id_fkey
        FOREIGN KEY (estudiante_id) REFERENCES estudiante(id) ON DELETE CASCADE;

ALTER TABLE chat_directo_mensaje
    DROP CONSTRAINT IF EXISTS chat_directo_mensaje_remitente_id_fkey,
    ADD CONSTRAINT chat_directo_mensaje_remitente_id_fkey
        FOREIGN KEY (remitente_id) REFERENCES estudiante(id) ON DELETE CASCADE;

ALTER TABLE chat_directo_mensaje
    DROP CONSTRAINT IF EXISTS chat_directo_mensaje_destinatario_id_fkey,
    ADD CONSTRAINT chat_directo_mensaje_destinatario_id_fkey
        FOREIGN KEY (destinatario_id) REFERENCES estudiante(id) ON DELETE CASCADE;
