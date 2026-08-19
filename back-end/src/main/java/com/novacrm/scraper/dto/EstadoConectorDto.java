package com.novacrm.scraper.dto;

import java.time.LocalDateTime;

/**
 * Estado en vivo de una fuente o conector de vacantes.
 *
 * @param nombre            identificador corto de la fuente (ej. LINKEDIN, JSEARCH, SMARTRECRUITERS)
 * @param segmento          segmento al que sirve (LOCAL_COLOMBIA, REMOTO_INGLES, EXTERIOR_VISA)
 * @param descripcion       descripción legible del conector y su tecnología
 * @param habilitado        si está activa en configuración
 * @param filtraPorCiudad   si admite filtro geográfico en la búsqueda
 * @param estado            salud operativa: ACTIVO, ESPERA_CONFIGURACION, ERROR, DESACTIVADO
 * @param cuotaRestante     peticiones restantes del periodo actual (null si no aplica)
 * @param cuotaLimite       límite mensual contratado o configurado (null si no aplica)
 * @param ultimaEjecucion   fecha y hora de la última sincronización en la que participó
 * @param ultimoConteo      ofertas recuperadas en la última ejecución
 * @param ultimoError       último mensaje de error registrado para esta fuente
 */
public record EstadoConectorDto(
        String nombre,
        String segmento,
        String descripcion,
        boolean habilitado,
        boolean filtraPorCiudad,
        String estado,
        Integer cuotaRestante,
        Integer cuotaLimite,
        LocalDateTime ultimaEjecucion,
        Integer ultimoConteo,
        String ultimoError
) {}
