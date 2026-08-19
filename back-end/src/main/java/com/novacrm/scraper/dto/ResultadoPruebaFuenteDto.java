package com.novacrm.scraper.dto;

import java.time.LocalDateTime;

/**
 * Resultado de una prueba de conexión o búsqueda exploratoria sobre una fuente.
 *
 * @param fuente             nombre de la fuente probada
 * @param exito              si la consulta respondió satisfactoriamente
 * @param estado             diagnóstico de resultado: OK, SIN_RESULTADOS, ERROR, DESHABILITADO
 * @param ofertasEncontradas cantidad de ofertas recuperadas en la prueba
 * @param latenciaMs         tiempo de respuesta en milisegundos
 * @param mensaje            mensaje descriptivo o error técnico retornado
 * @param timestamp          momento en que se realizó la prueba
 */
public record ResultadoPruebaFuenteDto(
        String fuente,
        boolean exito,
        String estado,
        int ofertasEncontradas,
        long latenciaMs,
        String mensaje,
        LocalDateTime timestamp
) {}
