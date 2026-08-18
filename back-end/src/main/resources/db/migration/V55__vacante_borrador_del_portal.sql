-- Borrador de vacante para el portal de empresas.
--
-- Los otros tres estados ya existen y estan en uso por todo el codigo:
--   en revision -> revisada = false, activo = true
--   publicada   -> revisada = true,  activo = true
--   cerrada     -> activo = false, con motivo_cierre
--
-- Meter un enum de cuatro valores obligaria a migrar cada consulta que hoy
-- pregunta por `revisada` o `activo`, que son muchas, a cambio de nada: seria
-- el mismo estado escrito de otra forma. Solo falta el cuarto caso, el de la
-- empresa que empieza a redactar y no ha terminado, y ese si es nuevo.
--
-- Por defecto falso: nada de lo que ya existe es un borrador.

ALTER TABLE vacante
    ADD COLUMN borrador BOOLEAN NOT NULL DEFAULT FALSE;

-- El portal lista los borradores de una empresa cada vez que entra.
CREATE INDEX idx_vacante_borrador_empresa
    ON vacante (empresa_id)
    WHERE borrador = TRUE;

COMMENT ON COLUMN vacante.borrador IS
    'La empresa la esta redactando y aun no la ha enviado a revision. No se muestra a nadie mas.';
