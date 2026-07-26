package com.novacrm.documento.dto;

import java.time.Instant;
import java.util.UUID;

public record DocumentoResponse(
        UUID id,
        UUID grupoId,
        int numeroVersion,
        UUID estudianteId,
        String estudianteNombre,
        UUID programaId,
        String programaNombre,
        String tipo,
        String nombre,
        String contentType,
        long tamano,
        String subidoPor,
        boolean actual,
        Instant createdAt
) {}
