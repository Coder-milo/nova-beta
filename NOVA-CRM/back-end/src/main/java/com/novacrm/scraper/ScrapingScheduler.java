package com.novacrm.scraper;

import com.novacrm.scraper.portal.PortalScraper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ScrapingScheduler {

    private static final Logger log = LoggerFactory.getLogger(ScrapingScheduler.class);

    private final List<PortalScraper> scrapers;

    public ScrapingScheduler(List<PortalScraper> scrapers) {
        this.scrapers = scrapers;
    }

    @Scheduled(cron = "0 0 6 * * ?")
    public void ejecutarScrapingDiario() {
        log.info("Iniciando scraping diario de vacantes...");
        String[] keywords = {"desarrollador", "ingeniero", "analista", "practicante", "tecnologo"};
        for (var scraper : scrapers) {
            try {
                for (String kw : keywords) {
                    int count = scraper.buscar(kw, "Bogotá").size();
                    log.info("[{}] '{}': {} vacantes encontradas", scraper.getPortalNombre(), kw, count);
                }
            } catch (Exception e) {
                log.error("Error en scraper {}: {}", scraper.getPortalNombre(), e.getMessage());
            }
        }
    }
}
