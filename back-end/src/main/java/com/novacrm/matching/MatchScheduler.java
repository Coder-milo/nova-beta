package com.novacrm.matching;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class MatchScheduler {

    private static final Logger log = LoggerFactory.getLogger(MatchScheduler.class);
    private final MatchingService matchingService;

    public MatchScheduler(MatchingService matchingService) {
        this.matchingService = matchingService;
    }

    @Scheduled(cron = "0 0 7 * * ?")
    public void ejecutarMatchingDiario() {
        log.info("Iniciando matching diario...");
        int matches = matchingService.ejecutarMatching();
        log.info("Matching diario completado. {} matches generados.", matches);
    }
}
