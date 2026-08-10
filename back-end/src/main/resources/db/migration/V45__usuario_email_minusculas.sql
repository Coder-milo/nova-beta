-- El correo deja de distinguir mayusculas.
--
-- La cuenta se buscaba con igualdad exacta en login, en refresh y en
-- recuperacion, mientras que la ficha del estudiante se busca sin distinguir
-- mayusculas. La misma persona era dos cosas distintas segun la mitad del
-- sistema, y en un movil que pone la primera letra en mayuscula por su cuenta
-- eso se vive como "mi correo no existe", sin mas explicacion.
--
-- Si dos cuentas solo se diferencian en mayusculas, esto para el despliegue a
-- proposito: son dos personas o son una duplicada, y eso lo decide alguien,
-- no una migracion.
DO $$
DECLARE
    repetidos TEXT;
BEGIN
    SELECT string_agg(DISTINCT lower(email), ', ')
      INTO repetidos
      FROM usuario
     GROUP BY lower(email)
    HAVING count(*) > 1;

    IF repetidos IS NOT NULL THEN
        RAISE EXCEPTION
            'Hay cuentas que solo se diferencian en mayusculas (%). Unifiquelas antes de aplicar esta migracion.',
            repetidos;
    END IF;
END $$;

UPDATE usuario SET email = lower(email) WHERE email <> lower(email);

-- Impide que vuelvan a crearse dos cuentas que solo se diferencian en la caja.
-- La restriccion UNIQUE de la columna sigue existiendo; esta la completa.
CREATE UNIQUE INDEX uk_usuario_email_minusculas ON usuario (lower(email));
