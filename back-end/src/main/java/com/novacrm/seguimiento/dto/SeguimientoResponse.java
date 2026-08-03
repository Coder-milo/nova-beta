package com.novacrm.seguimiento.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record SeguimientoResponse(
        UUID id,
        LocalDate fecha,
        String tipo,
        String responsable,
        String observacion,
        String proximaAccion,
        LocalDate fechaProxima,
        String estado,
        Instant createdAt
) {}
