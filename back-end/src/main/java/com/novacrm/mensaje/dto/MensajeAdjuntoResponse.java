package com.novacrm.mensaje.dto;

import java.util.UUID;

public record MensajeAdjuntoResponse(
        UUID id,
        String nombre,
        String contentType,
        long tamano,
        String url) {
}
