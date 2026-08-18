-- Quien lleva a cada participante.
--
-- El concepto no existia y por eso no se podia asignar responsable en lote
-- (punto 5 del plan). Habia cinco campos que suenan a lo mismo —
-- `programa.responsable`, `seguimiento.responsable`, `postulacion.gestionada_por`,
-- `actividad.responsable`, `vacante.creada_por`— y los cinco son texto libre sin
-- enlace a `usuario`. En la base ese texto ya guardaba tres cosas distintas a la
-- vez: correos de personas reales, la etiqueta "Equipo NOVA" que no es nadie, y
-- cadena vacia junto a NULL como dos formas de decir "nada".
--
-- Aquellos cinco campos NO se tocan, y no es descuido: son la traza de quien
-- hizo cada cosa aquel dia, y tienen que quedarse congelados aunque la persona
-- se vaya. Reasignar un caso no puede reescribir el historial. Lo que falta y se
-- crea aqui es otra cosa: la propiedad del caso, que si es un enlace vivo.

ALTER TABLE estudiante
    ADD COLUMN responsable_id UUID;

-- ON DELETE SET NULL, no CASCADE: si se borra la cuenta de quien acompanaba a
-- alguien, el participante se queda sin responsable —que es un hueco visible y
-- reasignable—, no borrado con ella.
ALTER TABLE estudiante
    ADD CONSTRAINT fk_estudiante_responsable
    FOREIGN KEY (responsable_id) REFERENCES usuario (id) ON DELETE SET NULL;

-- La consulta que justifica todo esto: "mis estudiantes". Parcial porque al
-- principio casi todas las filas estaran sin asignar y no tiene sentido
-- indexarlas.
CREATE INDEX idx_estudiante_responsable
    ON estudiante (responsable_id) WHERE responsable_id IS NOT NULL;

COMMENT ON COLUMN estudiante.responsable_id IS
    'Quien lleva el caso de este participante. Nulo = sin asignar, que es un estado normal y no un error.';
