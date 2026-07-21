package com.novacrm.scraper;

import com.novacrm.scraper.portal.PortalScraper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Orquesta la ejecución de todos los scrapers de portales.
 * Compartido por el scheduler diario y el endpoint de escaneo bajo demanda.
 */
@Service
public class ScrapingService {

    private static final Logger log = LoggerFactory.getLogger(ScrapingService.class);

    private static final String[] KEYWORDS = {
            "desarrollador", "ingeniero", "analista", "practicante", "tecnologo"
    };

    private final List<PortalScraper> scrapers;

    public ScrapingService(List<PortalScraper> scrapers) {
        this.scrapers = scrapers;
    }

    /** Ejecuta todos los scrapers con las palabras clave estándar. Devuelve el total de vacantes nuevas. */
    public int ejecutarScraping() {
        int total = 0;
        for (var scraper : scrapers) {
            for (String kw : KEYWORDS) {
                try {
                    int count = scraper.buscar(kw, "Bogotá").size();
                    log.info("[{}] '{}': {} vacantes nuevas", scraper.getPortalNombre(), kw, count);
                    total += count;
                } catch (Exception e) {
                    log.error("Error en scraper {} con '{}': {}", scraper.getPortalNombre(), kw, e.getMessage());
                }
            }
        }
        return total;
    }
}
