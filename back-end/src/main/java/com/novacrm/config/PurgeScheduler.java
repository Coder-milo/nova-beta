package com.novacrm.config;

import com.novacrm.admin.AdminService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * La purga automatica de la papelera, los domingos de madrugada.
 *
 * <p>No borra por su cuenta: llama a la misma purga que el boton de la pantalla
 * de administracion. Antes tenia su propia copia, y la copia se quedo atras en
 * las dos cosas que importan.
 *
 * <p>Los dias de retencion los estaba clavando en 30 mientras la pantalla
 * ofrecia un campo para cambiarlos y la purga manual ya lo respetaba. Subirlos
 * a 90 no salvaba ninguna ficha, porque quien borra de verdad es esto —nadie
 * purga a mano un domingo a las tres de la manana— y esto seguia contando 30.
 *
 * <p>Y no dejaba rastro. La purga manual se anota en auditoria; la automatica,
 * que es la que se lleva las fichas, no aparecia en ningun sitio. Si un dia
 * faltan personas, hace falta poder decir cuando se fueron y por que.
 */
@Component
public class PurgeScheduler {

    private static final Logger log = LoggerFactory.getLogger(PurgeScheduler.class);

    private final AdminService adminService;

    public PurgeScheduler(AdminService adminService) {
        this.adminService = adminService;
    }

    @Scheduled(cron = "0 0 3 * * SUN")
    public void purgarPapelera() {
        int eliminados = adminService.purgarPapelera();
        if (eliminados == 0) {
            log.info("Purga semanal: no hay estudiantes en papelera para eliminar");
            return;
        }
        log.info("Purga semanal: {} estudiantes eliminados fisicamente", eliminados);
    }
}
