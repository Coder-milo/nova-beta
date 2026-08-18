package com.novacrm.chat.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ChatDirectoMensajeResponse(
        UUID id,
        UUID remitenteId,
        String remitenteNombre,
        String contenido,
        Instant createdAt,
        boolean enviadoPorMi,
        Instant leidoAt,
        boolean editado,
        UUID enRespuestaA,
        boolean reenviado,
        /** Vacia si el mensaje es solo texto. */
        List<ChatAdjuntoResponse> adjuntos) { }
