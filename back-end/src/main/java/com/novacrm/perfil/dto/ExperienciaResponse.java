package com.novacrm.perfil.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ExperienciaResponse(
        UUID id,
        String empresa,
        String cargo,
        LocalDate fechaInicio,
        LocalDate fechaFin,
        boolean relacionada,
        String funciones,
        boolean actual,
        Instant createdAt
) {}
