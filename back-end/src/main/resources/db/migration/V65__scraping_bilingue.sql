-- Cuantas ofertas llego a traer la corrida pero no exigian ingles.
--
-- El programa es de empleabilidad bilingue: lo que no pide ingles se descarta
-- antes de guardar. Sin este numero, una corrida de «0 nuevas» no distingue
-- entre un portal caido y un portal sano que solo trajo plazas monolingues, y
-- son dos diagnosticos opuestos con el mismo sintoma.
--
-- Por defecto 0 y no nulo: en las corridas anteriores no se descartaba nada,
-- asi que cero es el valor cierto, no un «no se sabe».

ALTER TABLE scraping_ejecucion
    ADD COLUMN descartadas_por_idioma INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN scraping_ejecucion.descartadas_por_idioma IS
    'Ofertas devueltas por los portales que no mencionaban ingles y no se guardaron.';
