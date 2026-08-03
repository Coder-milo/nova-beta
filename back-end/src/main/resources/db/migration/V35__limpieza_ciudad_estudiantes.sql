-- Limpiar datos cruzados donde el campo 'ciudad' del estudiante contenía empresas
UPDATE estudiante
SET ciudad = NULL
WHERE ciudad LIKE '%Solvo%'
   OR ciudad LIKE '%Teleperformance%'
   OR ciudad LIKE '%Koombea%'
   OR ciudad LIKE '%Concentrix%'
   OR ciudad LIKE '%Alorica%'
   OR ciudad LIKE '%Eurocentres%'
   OR ciudad LIKE '%Sutherland%'
   OR ciudad LIKE '%\n%';
