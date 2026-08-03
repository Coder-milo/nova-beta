package com.novacrm.mensaje.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record MensajeResponse(
        UUID id,
        UUID estudianteId,
        String estudianteNombre,
        String estudianteEmail,
        String asunto,
        String contenido,
        String estado,
        Instant createdAt,
        String respuesta,
        String respondidoPor,
        Instant respondidoAt,
        List<MensajeAdjuntoResponse> adjuntos,
        List<MensajeAdjuntoResponse> respuestaAdjuntos) {
}
