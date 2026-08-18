package com.novacrm.scraper;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ScrapingEjecucionRepository extends JpaRepository<ScrapingEjecucion, UUID> {

    /** La ultima actualizacion terminada, que es la que se muestra en el panel. */
    Optional<ScrapingEjecucion> findFirstByFinIsNotNullOrderByInicioDesc();

    /**
     * Las ultimas corridas, para el registro del panel.
     *
     * <p>Veinte y no diez: con la tarea diaria mas los escaneos manuales, diez
     * filas no llegan a cubrir una semana, y la pregunta que se hace el equipo
     * —«desde cuando no entra nada de este portal»— necesita ver varios dias.
     */
    List<ScrapingEjecucion> findTop20ByOrderByInicioDesc();
}
