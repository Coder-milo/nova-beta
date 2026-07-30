-- El nombre del programa semilla pasa de «CAC Academy» a «CAC Academic».
--
-- Va en una migración nueva y no editando V19, que es donde se creó la fila:
-- Flyway guarda el checksum de cada migración ya aplicada y cambiar su
-- contenido hace que el arranque falle con «Migration checksum mismatch» en
-- toda base que la tuviera aplicada. Corregir el texto en el sitio original
-- solo funciona en una base creada desde cero.
UPDATE programa
SET descripcion = 'Programa de empleabilidad CAC Academic'
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND descripcion = 'Programa de empleabilidad CAC Academy';
