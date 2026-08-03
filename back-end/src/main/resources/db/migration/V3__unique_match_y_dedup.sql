-- Elimina matches duplicados conservando el mas antiguo por (estudiante_id, vacante_id)
DELETE FROM match_resultado
WHERE id NOT IN (
    SELECT DISTINCT ON (estudiante_id, vacante_id) id
    FROM match_resultado
    ORDER BY estudiante_id, vacante_id, created_at, id
);

-- Evita que el scheduler diario vuelva a insertar el mismo par
ALTER TABLE match_resultado
    ADD CONSTRAINT uq_match_estudiante_vacante UNIQUE (estudiante_id, vacante_id);
