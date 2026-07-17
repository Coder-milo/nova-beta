package com.novacrm.matching.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record MatchResponse(
        UUID id,
        UUID estudianteId,
        UUID vacanteId,
        String vacanteTitulo,
        String vacanteEmpresa,
        String vacanteUbicacion,
        String vacanteUrlOrigen,
        BigDecimal puntaje,
        boolean notificado,
        boolean postulado,
        Instant createdAt
) {}
