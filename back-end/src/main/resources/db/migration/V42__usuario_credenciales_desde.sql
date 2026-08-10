-- Momento desde el que valen las credenciales de una cuenta.
--
-- Cambiar la contrasena no echaba a nadie: quien ya tuviera una sesion abierta
-- podia seguir renovandola durante los siete dias que dura el refresh token, y
-- esa sesion abierta es justo el motivo por el que uno cambia la contrasena.
-- Con esta marca, un refresh emitido antes del cambio deja de renovarse.
--
-- Nula en las cuentas que ya existen: nadie ha cambiado su contrasena todavia,
-- asi que no hay nada que invalidar y las sesiones en curso siguen valiendo.
ALTER TABLE usuario ADD COLUMN credenciales_desde TIMESTAMP NULL;
