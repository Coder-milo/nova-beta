package com.novacrm.scraper.dto;

import java.time.LocalDateTime;

/**
 * Resultado de una actualizacion de vacantes.
 *
 * @param vacantesNuevas   ofertas que entraron en esta corrida
 * @param vacantesCerradas ofertas que se cerraron por haber vencido
 * @param vigentesTotal    ofertas disponibles ahora mismo
 */
public record ResultadoActualizacion(
        int vacantesNuevas,
        int vacantesCerradas,
        long vigentesTotal,
        LocalDateTime inicio,
        LocalDateTime fin) {}
