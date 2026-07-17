package com.novacrm.notificacion.dto;

import java.time.Instant;
import java.util.UUID;

public record NotificacionResponse(
        UUID id,
        String titulo,
        String mensaje,
        String tipo,
        String referenciaId,
        boolean leida,
        Instant createdAt
) {}
