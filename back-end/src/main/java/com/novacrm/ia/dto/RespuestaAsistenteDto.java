package com.novacrm.ia.dto;

import java.util.List;

public record RespuestaAsistenteDto(
        String respuesta,
        AccionNavegacion accionNavegacion,
        List<String> sugerencias
) {
    public record AccionNavegacion(
            String etiqueta,
            String url
    ) {}
}
