-- El catalogo inicial existia, pero ningun programa lo tenia asignado y por
-- eso el portal ocultaba por completo "Tus plataformas". Se habilitan las
-- plataformas activas para los programas actuales. La configuracion posterior
-- del administrador sigue mandando y puede quitar cualquiera de ellas.
INSERT INTO programa_plataforma (programa_id, plataforma_id)
SELECT programa.id, plataforma.id
FROM programa
CROSS JOIN plataforma
WHERE plataforma.activo = TRUE
ON CONFLICT (programa_id, plataforma_id) DO NOTHING;

