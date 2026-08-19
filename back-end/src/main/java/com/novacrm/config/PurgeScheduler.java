package com.novacrm.config;

import com.novacrm.admin.AdminService;
import com.novacrm.configuracion.ConfiguracionService;
import com.novacrm.postulacion.PostulacionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * La purga automatica de la papelera y postulaciones inactivas, los domingos de madrugada.
 */
@Component
public class PurgeScheduler {

    private static final Logger log = LoggerFactory.getLogger(PurgeScheduler.class);

    private final AdminService adminService;
    private final PostulacionService postulacionService;
    private final ConfiguracionService configuracionService;

    public PurgeScheduler(AdminService adminService,
                          PostulacionService postulacionService,
                          ConfiguracionService configuracionService) {
        this.adminService = adminService;
        this.postulacionService = postulacionService;
        this.configuracionService = configuracionService;
    }

    @Scheduled(cron = "0 0 3 * * SUN")
    public void purgarPapelera() {
        int eliminados = adminService.purgarPapelera();
        if (eliminados == 0) {
            log.info("Purga semanal: no hay estudiantes en papelera para eliminar");
        } else {
            log.info("Purga semanal: {} estudiantes eliminados fisicamente", eliminados);
        }

        int diasRetencion = configuracionService.diasRetencionPapelera();
        int postulacionesPurgadas = postulacionService.purgarPostulacionesInactivas(diasRetencion);
        if (postulacionesPurgadas > 0) {
            log.info("Purga semanal: {} postulaciones terminales e inactivas eliminadas", postulacionesPurgadas);
        }

        int invalidasLimpiadas = postulacionService.limpiarPostulacionesDeVacantesInvalidas();
        if (invalidasLimpiadas > 0) {
            log.info("Purga semanal: {} postulaciones de vacantes fuera de zona eliminadas", invalidasLimpiadas);
        }
    }
}
