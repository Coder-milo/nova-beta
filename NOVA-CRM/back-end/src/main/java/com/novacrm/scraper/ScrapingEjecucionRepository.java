package com.novacrm.scraper;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ScrapingEjecucionRepository extends JpaRepository<ScrapingEjecucion, UUID> {

    /** La ultima actualizacion terminada, que es la que se muestra en el panel. */
    Optional<ScrapingEjecucion> findFirstByFinIsNotNullOrderByInicioDesc();

    List<ScrapingEjecucion> findTop10ByOrderByInicioDesc();
}
