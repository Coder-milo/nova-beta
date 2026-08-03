-- Flyway V20: Múltiples plantillas de Hoja de Vida (ATS, Clásico con foto, Moderno) y preferencia de estudiante

ALTER TABLE plantilla_hv ADD COLUMN IF NOT EXISTS codigo VARCHAR(50);
CREATE UNIQUE INDEX IF NOT EXISTS idx_plantilla_hv_codigo ON plantilla_hv(codigo) WHERE codigo IS NOT NULL;

ALTER TABLE estudiante ADD COLUMN IF NOT EXISTS plantilla_preferida_id UUID REFERENCES plantilla_hv(id) ON DELETE SET NULL;

-- Sembrado inicial de las 3 plantillas del sistema
INSERT INTO plantilla_hv (id, codigo, nombre, color_primario, predeterminada, activo, created_at)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'CAC_ATS', 'CAC ATS Tradicional (Sin foto)', '#1F4E79', TRUE, TRUE, NOW()),
  ('a0000000-0000-0000-0000-000000000002', 'CLASICO_FOTO', 'Clásico Profesional (Con foto)', '#2A5C8A', FALSE, TRUE, NOW()),
  ('a0000000-0000-0000-0000-000000000003', 'MODERNO', 'Moderno Compacto (Dos columnas)', '#0F4C81', FALSE, TRUE, NOW())
ON CONFLICT (id) DO UPDATE SET codigo = EXCLUDED.codigo;
