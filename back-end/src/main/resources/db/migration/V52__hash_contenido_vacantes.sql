-- La misma oferta publicada en varios portales (Elempleo, Computrabajo, JSearch)
-- entraba una vez por cada fuente: el hash_dedup lleva la fuente dentro, asi que
-- "ELEMPLEO|123" y "COMPUTRABAJO|123" son hashes distintos. El matching puntuaba
-- el duplicado dos veces y el listado lo mostraba dos veces.
--
-- hash_contenido es la identidad de la oferta mas alla de la fuente: se calcula
-- en Java (RegistroDeVacante) normalizando titulo + empresa, sin funcion de base
-- de datos. Nulleable a proposito: las filas historicas quedan sin el y solo se
-- protegen las nuevas; en Postgres un indice UNIQUE admite varios NULL, asi que
-- las existentes no estorban.
ALTER TABLE vacante ADD COLUMN hash_contenido VARCHAR(64);
CREATE UNIQUE INDEX idx_vacante_hash_contenido ON vacante (hash_contenido);