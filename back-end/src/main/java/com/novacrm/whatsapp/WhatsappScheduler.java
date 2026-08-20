package com.novacrm.whatsapp;

import com.novacrm.programa.Programa;
import com.novacrm.programa.ProgramaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Tareas programadas de WhatsApp con frecuencia inteligente.
 *
 * <p>Reglas de cadencia para proteger el presupuesto de Meta:
 * <ul>
 *   <li><strong>Lunes 09:00 AM:</strong> Resumen semanal de empleo (Weekly Digest).</li>
 *   <li><strong>Miércoles y Viernes 10:00 AM:</strong> Nudge de inactividad a estudiantes sin postulaciones.</li>
 * </ul>
 */
@Component
@ConditionalOnProperty(name = "app.whatsapp.scheduler.enabled", havingValue = "true", matchIfMissing = true)
public class WhatsappScheduler {

    private static final Logger log = LoggerFactory.getLogger(WhatsappScheduler.class);

    private final WhatsappAutomatizacionesService automatizacionesService;
    private final ProgramaRepository programaRepository;

    public WhatsappScheduler(WhatsappAutomatizacionesService automatizacionesService,
                             ProgramaRepository programaRepository) {
        this.automatizacionesService = automatizacionesService;
        this.programaRepository = programaRepository;
    }

    /**
     * Resumen semanal consolidado de vacantes: todos los lunes a las 9:00 AM.
     */
    @Scheduled(cron = "0 0 9 * * MON", zone = "America/Bogota")
    public void ejecutarResumenSemanal() {
        log.info("Iniciando tarea programada: Resumen semanal de vacantes por WhatsApp");
        List<Programa> programas = programaRepository.findByActivoTrueOrderByCreatedAtDesc();
        for (Programa p : programas) {
            try {
                var res = automatizacionesService.ejecutarResumenSemanalVacantes(p.getId(), false);
                log.info("Resumen semanal ejecutado para {}: {} enviados de {} elegibles",
                        p.getNombre(), res.enviados(), res.elegibles());
            } catch (Exception e) {
                log.warn("Error en resumen semanal de WhatsApp para {}: {}", p.getNombre(), e.getMessage());
            }
        }
    }

    /**
     * Nudge de inactividad: miércoles y viernes a las 10:00 AM.
     */
    @Scheduled(cron = "0 0 10 * * WED,FRI", zone = "America/Bogota")
    public void ejecutarNudgesInactividad() {
        log.info("Iniciando tarea programada: Nudges de inactividad por WhatsApp");
        List<Programa> programas = programaRepository.findByActivoTrueOrderByCreatedAtDesc();
        for (Programa p : programas) {
            try {
                var res = automatizacionesService.ejecutarNudgeInactividad(p.getId(), 7, false);
                log.info("Nudges de inactividad ejecutados para {}: {} enviados de {} elegibles",
                        p.getNombre(), res.enviados(), res.elegibles());
            } catch (Exception e) {
                log.warn("Error en nudges de WhatsApp para {}: {}", p.getNombre(), e.getMessage());
            }
        }
    }
}
