-- V7: template content + field manifest for CAC ATS resume templates

ALTER TABLE plantilla_hv
    ADD COLUMN IF NOT EXISTS contenido_html TEXT,
    ADD COLUMN IF NOT EXISTS field_manifest TEXT;
