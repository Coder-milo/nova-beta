-- Las URLs de las imagenes de marca viajaban con el host de quien las subio:
-- en desarrollo quedaban como http://localhost:8080/... y, al enviar el correo,
-- el cliente del destinatario intentaba abrir su propia maquina. Desde ahora la
-- tabla guarda solo la clave de almacenamiento (branding/xxx.png) y la URL se
-- construye al servir con app.correo.base-url-publica. Esto convierte los
-- valores ya guardados. Las URLs externas (a un CDN, por ejemplo) no tienen el
-- prefijo del servidor y se conservan tal cual.

UPDATE programa_branding
SET banner_panel_url  = CASE WHEN position('/api/v1/branding/imagen/' in banner_panel_url)  > 0
                             THEN substr(banner_panel_url, position('/api/v1/branding/imagen/' in banner_panel_url) + length('/api/v1/branding/imagen/'))
                             ELSE banner_panel_url END,
    correo_header_url = CASE WHEN position('/api/v1/branding/imagen/' in correo_header_url) > 0
                             THEN substr(correo_header_url, position('/api/v1/branding/imagen/' in correo_header_url) + length('/api/v1/branding/imagen/'))
                             ELSE correo_header_url END,
    correo_pie_url    = CASE WHEN position('/api/v1/branding/imagen/' in correo_pie_url)    > 0
                             THEN substr(correo_pie_url, position('/api/v1/branding/imagen/' in correo_pie_url) + length('/api/v1/branding/imagen/'))
                             ELSE correo_pie_url END
WHERE banner_panel_url LIKE '%/api/v1/branding/imagen/%'
   OR correo_header_url LIKE '%/api/v1/branding/imagen/%'
   OR correo_pie_url    LIKE '%/api/v1/branding/imagen/%';