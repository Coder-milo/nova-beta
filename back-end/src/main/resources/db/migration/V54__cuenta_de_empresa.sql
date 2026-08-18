-- Cuentas del portal de empresas.
--
-- Es el primer rol que no pertenece a la institucion. Hasta ahora todos los
-- usuarios eran de casa —admin, coordinador, estudiante— y el peor caso de un
-- permiso mal puesto era que alguien viera de mas dentro de su propia
-- organizacion. Una empresa es un tercero: el peor caso es que datos de
-- estudiantes salgan fuera.
--
-- Por eso el vinculo es una columna y no una tabla puente: una cuenta pertenece
-- a una empresa y solo a una. Con una relacion N-a-N habria que decidir en cada
-- consulta cual de las empresas manda, y esa es exactamente la clase de duda
-- que termina en una consulta sin filtrar.

ALTER TABLE usuario
    ADD COLUMN empresa_id UUID REFERENCES empresa (id);

-- El portal filtra por esta columna en cada consulta.
CREATE INDEX idx_usuario_empresa
    ON usuario (empresa_id)
    WHERE empresa_id IS NOT NULL;

-- Una cuenta con rol EMPRESA sin empresa asignada no puede ver nada, pero
-- tampoco deberia poder existir: seria una cuenta que entra y se encuentra el
-- portal vacio sin explicacion. La comprobacion vive en la tabla de roles
-- porque es ahi donde se concede el rol.
--
-- No se puede expresar como CHECK —necesita mirar otra tabla—, asi que va como
-- trigger. Es barato: solo corre al conceder o quitar roles, que pasa unas
-- pocas veces al dia.
CREATE OR REPLACE FUNCTION exigir_empresa_en_cuenta_de_empresa()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.rol = 'EMPRESA'
       AND (SELECT empresa_id FROM usuario WHERE id = NEW.usuario_id) IS NULL THEN
        RAISE EXCEPTION
            'Una cuenta con rol EMPRESA necesita una empresa asignada (usuario %)',
            NEW.usuario_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_exigir_empresa_en_cuenta_de_empresa
    BEFORE INSERT OR UPDATE ON usuario_rol
    FOR EACH ROW
    EXECUTE FUNCTION exigir_empresa_en_cuenta_de_empresa();

COMMENT ON COLUMN usuario.empresa_id IS
    'Empresa a la que pertenece la cuenta del portal. Nula para el personal del programa y los estudiantes.';
