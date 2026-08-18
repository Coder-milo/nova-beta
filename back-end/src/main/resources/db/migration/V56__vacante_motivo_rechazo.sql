-- Por que se rechaza una vacante en la revision.
--
-- Hasta ahora la moderacion solo sabia decir que si. Lo unico que se podia
-- hacer con una oferta dudosa era cerrarla, y la empresa que la publico veia
-- «Cerrada» sin ninguna explicacion: ni sabe que hizo mal, ni puede corregirlo,
-- asi que vuelve a publicar lo mismo. Una puerta que solo se abre no es una
-- revision, es un tramite.
--
-- El motivo se guarda en la vacante y no en un registro aparte porque es lo que
-- tiene que leer la empresa en su propia pantalla, junto al texto que escribio.

ALTER TABLE vacante
    ADD COLUMN motivo_rechazo TEXT,
    ADD COLUMN rechazada_por  VARCHAR(255),
    ADD COLUMN fecha_rechazo  TIMESTAMP;

COMMENT ON COLUMN vacante.motivo_rechazo IS
    'Lo que el equipo le dice a quien la publico. Se borra al volver a enviarla a revision.';
