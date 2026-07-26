package com.novacrm.perfil.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record FormacionResponse(
        UUID id,
        String tipo,
        String institucion,
        String programa,
        LocalDate fechaInicio,
        LocalDate fechaFin,
        String estado,
        Instant createdAt
) {}
