package com.novacrm.scraper;

import com.novacrm.matching.MatchingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ScrapingScheduler {

    private static final Logger log = LoggerFactory.getLogger(ScrapingScheduler.class);

    private final ScrapingService scrapingService;
    private final MatchingService matchingService;

    public ScrapingScheduler(ScrapingService scrapingService, MatchingService matchingService) {
        this.scrapingService = scrapingService;
        this.matchingService = matchingService;
    }

    /**
     * Ejecución diaria a las 2:00 AM (Hora Colombia / America/Bogota).
     *
     * 1. Consulta portales y actualiza el banco de vacantes (filtrando exclusivamente Atlántico o Remotas).
     * 2. Recalcula el matching para todos los estudiantes activos, asegurando que amanezcan con
     *    las nuevas oportunidades evaluadas y listas para postularse.
     */
    @Scheduled(cron = "0 0 2 * * ?", zone = "America/Bogota")
    public void ejecutarScrapingDiario() {
        log.info("Iniciando actualización automática de vacantes a las 2:00 AM (América/Bogotá)...");
        var resultado = scrapingService.actualizar(ScrapingEjecucion.Origen.PROGRAMADA);
        log.info("Actualización diaria de vacantes completada: {} nuevas, {} cerradas, {} vigentes en total",
                resultado.vacantesNuevas(), resultado.vacantesCerradas(),
                resultado.vigentesTotal());

        log.info("Iniciando recálculo automático de matching de vacantes para estudiantes activos...");
        try {
            int matchesGenerados = matchingService.ejecutarMatching();
            log.info("Matching automático de las 2:00 AM completado con éxito: {} nuevos matches generados.", matchesGenerados);
        } catch (Exception e) {
            log.error("Error al ejecutar el matching automático tras el scraping: {}", e.getMessage(), e);
        }
    }
}
