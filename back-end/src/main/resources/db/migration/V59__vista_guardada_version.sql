-- Falta la columna de bloqueo optimista en vista_guardada.
--
-- V57 creó la tabla a mano y se dejó `version`, que `BaseEntity` declara con
-- @Version y que llevan todas las demás tablas del esquema. Con
-- `ddl-auto: validate` en producción, Hibernate se niega a arrancar:
--
--   Schema-validation: missing column [version] in table [vista_guardada]
--
-- No se pudo ver antes porque los tests usan H2 con `ddl-auto: create-drop`:
-- ahí el esquema lo genera Hibernate a partir de las entidades, así que una
-- migración incompleta pasa desapercibida por construcción. Compilar y pasar
-- los tests no comprueba que las migraciones y las entidades coincidan; eso
-- solo se ve arrancando contra el esquema real.
--
-- V57 no se puede corregir en su sitio: ya está aplicada y cambiar una letra
-- altera su checksum, con lo que Flyway se negaría a arrancar.

-- `IF NOT EXISTS` porque la columna se aplicó a mano en el entorno local para
-- desatascar el arranque antes de que esta migración existiera. En una base
-- limpia se crea aquí; en la que ya la tiene, no falla.
ALTER TABLE vista_guardada
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
