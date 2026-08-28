-- Crear/garantizar usuario administrador principal para Career Services CAC
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO usuario (id, email, password, nombre, activo)
VALUES (
    uuid_generate_v4(),
    'careerservices@cacenglish.com.co',
    crypt('careerservicesCAC2023', gen_salt('bf', 10)),
    'Career Services CAC',
    TRUE
)
ON CONFLICT (email) DO UPDATE 
SET password = crypt('careerservicesCAC2023', gen_salt('bf', 10)),
    nombre = 'Career Services CAC',
    activo = TRUE;

INSERT INTO usuario_rol (usuario_id, rol)
SELECT id, 'ADMIN' FROM usuario WHERE email = 'careerservices@cacenglish.com.co'
ON CONFLICT DO NOTHING;
