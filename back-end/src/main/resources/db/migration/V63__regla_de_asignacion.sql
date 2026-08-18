-- Como se reparte un participante nuevo entre el equipo.
--
-- Apagado por defecto (`NINGUNA`), y no es prudencia de mas: una regla de
-- reparto que no coincide con como trabaja el equipo se desactiva la primera
-- semana, y hasta entonces asigna mal. Que haya que encenderla obliga a que
-- alguien decida, que es justo lo que falta cuando se hereda una regla puesta
-- por defecto.
--
-- Solo dos valores, y las alternativas se descartaron por motivos concretos:
--
--   * Por programa: los 108 participantes estan en uno solo, asi que asignaria
--     los 108 a la misma persona. Es el mismo motivo por el que se descarto el
--     responsable "por proyecto" en el punto 13.
--   * Por ciudad: obliga a mantener un mapa ciudad -> persona, y las ciudades
--     entran por importacion como texto libre —hay filas con "Otro" y con
--     "Sin dato"—. El mapa se desactualiza solo.
--
-- `ROTATIVO` no necesita ninguna tabla de apoyo: reparte a quien menos casos
-- lleve en ese momento.
ALTER TABLE configuracion_global
    ADD COLUMN regla_asignacion VARCHAR(20) NOT NULL DEFAULT 'NINGUNA';

COMMENT ON COLUMN configuracion_global.regla_asignacion IS
    'NINGUNA = nadie se asigna solo. ROTATIVO = al de menos carga en ese momento.';
