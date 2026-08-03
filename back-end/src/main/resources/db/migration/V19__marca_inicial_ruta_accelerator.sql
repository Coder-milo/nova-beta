-- La identidad visual inicial se versiona junto con sus archivos de storage.
-- Asi una base nueva puede mostrar la misma marca sin depender de la carpeta
-- local de quien hizo la carga original. No se reemplaza una marca existente.

INSERT INTO programa (id, nombre, descripcion, estado, activo)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Ruta Accelerator',
    'Programa de empleabilidad CAC Academy',
    'ACTIVO',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO programa_branding (
    programa_id,
    color_primario,
    banner_panel_url, banner_panel_ancho, banner_panel_alto,
    correo_header_url, correo_header_ancho, correo_header_alto,
    correo_pie_url, correo_pie_ancho, correo_pie_alto
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '#0F7B5A',
    'http://localhost:8080/api/v1/branding/imagen/branding/a71531c1-6381-484a-ac5d-be6d16555ecc-bannerPanel.png', 2400, 300,
    'http://localhost:8080/api/v1/branding/imagen/branding/3b597cfd-071f-4505-9170-8b50c4b47fab-correoHeader.png', 1200, 400,
    'http://localhost:8080/api/v1/branding/imagen/branding/48ec6fa8-8bf0-42a1-a102-4cfc607f3f31-correoPie.png', 1200, 300
)
ON CONFLICT (programa_id) DO NOTHING;
