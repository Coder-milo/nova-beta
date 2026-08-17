-- Formulario publico de captacion: lo que declara quien envia una oferta sin
-- tener cuenta.
--
-- Van en `vacante` y no en `empresa` a proposito. Enlazar la oferta con una
-- empresa por coincidencia de nombre —que es lo que hace el alta interna— seria
-- dejar que un desconocido publique en nombre de una empresa real, y si esa
-- empresa tiene cuenta del portal, verla aparecer entre las suyas. Aqui el
-- nombre es una afirmacion sin verificar hasta que alguien del equipo la
-- enlaza a mano; `empresa_id` se queda nulo.

ALTER TABLE vacante
    ADD COLUMN empresa_declarada  VARCHAR(200),
    ADD COLUMN contacto_declarado VARCHAR(200),
    ADD COLUMN email_declarado    VARCHAR(255),
    ADD COLUMN telefono_declarado VARCHAR(40);

COMMENT ON COLUMN vacante.empresa_declarada IS
    'Nombre de empresa que dice tener quien envio el formulario publico. Sin verificar: no enlaza con empresa_id.';
COMMENT ON COLUMN vacante.email_declarado IS
    'Correo de contacto declarado. Solo viaja hacia gestion; el estudiante no lo ve.';
