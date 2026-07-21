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

    @Scheduled(cron = "0 0 6 * * ?")
    public void ejecutarScrapingDiario() {
        log.info("Iniciando scraping diario de vacantes...");
        int total = scrapingService.ejecutarScraping();
        log.info("Scraping diario completado: {} vacantes nuevas", total);
    }
}
