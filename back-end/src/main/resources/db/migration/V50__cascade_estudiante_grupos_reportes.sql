-- Las tablas de grupos (V43) y de reportes (V44) entraron con FK a estudiante
-- sin ON DELETE. Es la misma trampa que V23 ya desactivo para los mensajes:
-- borrar a un estudiante (papelera, reset de programa, borrado masivo) choca
-- con la FK y hace rollback de TODA la operacion, no solo de esa persona.
--
-- Pero no todas quieren la misma respuesta, y por eso no vale copiar el CASCADE
-- de V23 en las cuatro.

-- El grupo NO se va con quien lo creo. Un grupo es de sus miembros; que se
-- borre la ficha de quien pulso "crear" no puede vaciarle la conversacion a los
-- otros veinte. Se queda sin autor conocido, que es exactamente lo que pasa.
ALTER TABLE chat_grupo ALTER COLUMN creado_por DROP NOT NULL;
ALTER TABLE chat_grupo
    DROP CONSTRAINT IF EXISTS chat_grupo_creado_por_fkey,
    ADD CONSTRAINT chat_grupo_creado_por_fkey
        FOREIGN KEY (creado_por) REFERENCES estudiante(id) ON DELETE SET NULL;

-- Los mensajes si. Misma decision que V23 tomo para el chat directo: lo que
-- alguien escribio no sobrevive a su ficha.
ALTER TABLE chat_grupo_mensaje
    DROP CONSTRAINT IF EXISTS chat_grupo_mensaje_remitente_id_fkey,
    ADD CONSTRAINT chat_grupo_mensaje_remitente_id_fkey
        FOREIGN KEY (remitente_id) REFERENCES estudiante(id) ON DELETE CASCADE;

-- El reporte sobrevive a las dos partes. V44 ya lo dejo escrito para los
-- mensajes —«quien acosa borra, y un reporte que apunta a mensajes borrados no
-- le sirve a nadie», por eso guarda el extracto como texto— y con las personas
-- pasa lo mismo: si el reporte se fuera con el denunciado, dar de baja la
-- cuenta denunciada borraria la denuncia. El caso se queda, con el extracto
-- intacto, y sin nombre de quien ya no esta.
ALTER TABLE chat_reporte ALTER COLUMN denunciante_id DROP NOT NULL;
ALTER TABLE chat_reporte ALTER COLUMN denunciado_id DROP NOT NULL;
ALTER TABLE chat_reporte
    DROP CONSTRAINT IF EXISTS chat_reporte_denunciante_id_fkey,
    ADD CONSTRAINT chat_reporte_denunciante_id_fkey
        FOREIGN KEY (denunciante_id) REFERENCES estudiante(id) ON DELETE SET NULL;
ALTER TABLE chat_reporte
    DROP CONSTRAINT IF EXISTS chat_reporte_denunciado_id_fkey,
    ADD CONSTRAINT chat_reporte_denunciado_id_fkey
        FOREIGN KEY (denunciado_id) REFERENCES estudiante(id) ON DELETE SET NULL;

-- El CHECK comparaba las dos columnas; con NULL la comparacion no es TRUE y la
-- fila pasaria igual, pero se deja explicito para que se lea lo que permite.
ALTER TABLE chat_reporte DROP CONSTRAINT IF EXISTS chk_chat_reporte_distintos;
ALTER TABLE chat_reporte
    ADD CONSTRAINT chk_chat_reporte_distintos
        CHECK (denunciante_id IS NULL OR denunciado_id IS NULL
               OR denunciante_id <> denunciado_id);
