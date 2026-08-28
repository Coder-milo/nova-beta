-- Garantiza que el usuario administrador inicial tenga la clave admin123 correctamente hasheada
UPDATE usuario 
SET password = '$2a$10$36.QGheqnlYB/Bs9g7DveeJK2ovKsriGQPt1PcZTLpiVmhdQnYl6i'
WHERE email = 'admin@novacrm.com';
