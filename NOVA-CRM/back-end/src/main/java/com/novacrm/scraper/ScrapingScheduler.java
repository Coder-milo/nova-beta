package com.novacrm.scraper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ScrapingScheduler {

    private static final Logger log = LoggerFactory.getLogger(ScrapingScheduler.class);

    private final ScrapingService scrapingService;

    public ScrapingScheduler(ScrapingService scrapingService) {
        this.scrapingService = scrapingService;
    }

    /**
     * Una vez al dia. La frecuencia no es casual: las condiciones de uso de las
     * APIs de las que se toman ofertas piden no consultarlas mas de unas pocas
     * veces diarias.
     */
    @Scheduled(cron = "0 0 6 * * ?")
    public void ejecutarScrapingDiario() {
        log.info("Iniciando actualizacion diaria de vacantes...");
        var resultado = scrapingService.actualizar(ScrapingEjecucion.Origen.PROGRAMADA);
        log.info("Actualizacion diaria completada: {} nuevas, {} cerradas, {} vigentes",
                resultado.vacantesNuevas(), resultado.vacantesCerradas(),
                resultado.vigentesTotal());
    }
}
