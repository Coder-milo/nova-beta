package com.novacrm.chat.dto;

import java.time.Instant;
import java.util.UUID;

public record ChatDirectoMensajeResponse(
        UUID id,
        UUID remitenteId,
        String remitenteNombre,
        String contenido,
        Instant createdAt,
        boolean enviadoPorMi) { }
