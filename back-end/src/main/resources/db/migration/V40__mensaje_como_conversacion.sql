-- Un mensaje deja de ser un ticket y pasa a ser una conversacion.
--
-- Hasta ahora `mensaje_estudiante` guardaba una pregunta y UNA respuesta, las
-- dos como columnas de texto de la misma fila. Sobre eso no se puede responder
-- a un turno concreto ni reaccionar a el: no hay a que apuntar. La bandeja de
-- la cabecera ya simulaba conversaciones agrupando por estudiante, pero por
-- debajo cada mensaje admitia exactamente un intercambio.
--
-- La fila de `mensaje_estudiante` se conserva como cabecera del hilo —asunto,
-- estado, a quien pertenece— y los textos se mudan a turnos. Las columnas
-- viejas NO se borran en esta migracion: mientras el codigo que las lee siga
-- desplegado, quitarlas dejaria la aplicacion sin arrancar en el hueco entre
-- migrar y desplegar. Se retiran en una migracion posterior, cuando nadie las
-- use.

CREATE TABLE mensaje_turno (
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version BIGINT,
    mensaje_id UUID NOT NULL REFERENCES mensaje_estudiante(id) ON DELETE CASCADE,
    -- Correo de quien escribe. No es una FK a usuario: el equipo responde con
    -- cuentas que pueden darse de baja, y perder el autor de un turno historico
    -- por eso seria peor que conservar un correo suelto.
    autor_email VARCHAR(255) NOT NULL,
    -- Se guarda en vez de deducirlo al leer: el turno hay que pintarlo a un
    -- lado o al otro, y resolverlo con una consulta por turno es lo que
    -- convierte una bandeja en cien consultas.
    autor_es_estudiante BOOLEAN NOT NULL,
    contenido TEXT NOT NULL,
    -- A que turno concreto responde este, si responde a alguno.
    -- ON DELETE SET NULL: borrar un turno citado no puede llevarse por delante
    -- las respuestas que colgaban de el; se quedan sin cita, que es recuperable.
    en_respuesta_a UUID REFERENCES mensaje_turno(id) ON DELETE SET NULL
);

CREATE INDEX idx_mensaje_turno_hilo ON mensaje_turno (mensaje_id, created_at);

-- Reacciones.
--
-- Clave propia y no compuesta por (turno, autor, emoji), para que la entidad
-- siga el mismo patron que el resto del modelo; la regla de negocio —una
-- persona pone un emoji concreto una sola vez— la impone igual el indice
-- unico. Sin el, pulsar dos veces acumularia reacciones repetidas y habria
-- que deduplicar al leer, que es tarde.
CREATE TABLE mensaje_reaccion (
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version BIGINT,
    turno_id UUID NOT NULL REFERENCES mensaje_turno(id) ON DELETE CASCADE,
    autor_email VARCHAR(255) NOT NULL,
    emoji VARCHAR(16) NOT NULL,
    CONSTRAINT uq_mensaje_reaccion UNIQUE (turno_id, autor_email, emoji)
);

CREATE INDEX idx_mensaje_reaccion_turno ON mensaje_reaccion (turno_id);

-- Los adjuntos cuelgan del turno, no del hilo: hasta ahora se distinguian con
-- un booleano `es_respuesta`, que solo sabe decir "de la pregunta" o "de la
-- respuesta" y deja de servir en cuanto hay mas de dos turnos.
ALTER TABLE mensaje_adjunto ADD COLUMN turno_id UUID REFERENCES mensaje_turno(id) ON DELETE CASCADE;

-- ── Traslado del historial ───────────────────────────────────────────────────

-- Turno 1: lo que escribio el estudiante. Hereda la fecha del mensaje para que
-- el hilo conserve su orden real.
INSERT INTO mensaje_turno (id, created_at, updated_at, mensaje_id, autor_email, autor_es_estudiante, contenido)
SELECT gen_random_uuid(), m.created_at, m.created_at, m.id, e.email, TRUE, m.contenido
FROM mensaje_estudiante m
JOIN estudiante e ON e.id = m.estudiante_id;

-- Turno 2: la respuesta del equipo, solo donde la haya. `respondido_at` puede
-- ser nulo en filas antiguas, asi que se cae a la fecha del mensaje antes que
-- dejar el turno sin fecha y romper el orden del hilo.
INSERT INTO mensaje_turno (id, created_at, updated_at, mensaje_id, autor_email, autor_es_estudiante, contenido)
SELECT gen_random_uuid(),
       COALESCE(m.respondido_at, m.created_at),
       COALESCE(m.respondido_at, m.created_at),
       m.id,
       COALESCE(m.respondido_por, 'equipo'),
       FALSE,
       m.respuesta
FROM mensaje_estudiante m
WHERE m.respuesta IS NOT NULL AND btrim(m.respuesta) <> '';

-- Cada adjunto va al turno que le corresponde segun el booleano viejo.
UPDATE mensaje_adjunto a
SET turno_id = t.id
FROM mensaje_turno t
WHERE t.mensaje_id = a.mensaje_id
  AND t.autor_es_estudiante = (a.es_respuesta = FALSE);
