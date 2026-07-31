-- Una sola version vigente por estudiante, impuesto por la base. Sin esto,
-- dos generaciones concurrentes de la misma HV podian leer la misma
-- numero_version y quedar ambas con actual = true. Es un indice parcial:
-- las versiones historicas conviven, la vigente es unica.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hv_estudiante_actual
    ON hoja_de_vida (estudiante_id)
    WHERE actual = true;
