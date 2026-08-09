package com.novacrm.ia.dto;

import java.util.List;
import java.util.Map;

public record RespuestaAsistenteDto(
        String respuesta,
        AccionNavegacion accionNavegacion,
        List<String> sugerencias,
        PlanAccion planAccion
) {
    public RespuestaAsistenteDto(String respuesta, AccionNavegacion accionNavegacion, List<String> sugerencias) {
        this(respuesta, accionNavegacion, sugerencias, null);
    }

    public record AccionNavegacion(
            String etiqueta,
            String url
    ) {}

    public record PlanAccion(
            String tipo,
            String titulo,
            String descripcion,
            Map<String, Object> parametros
    ) {}
}
