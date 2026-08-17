package com.novacrm.excel.dto;

import java.time.Instant;
import java.util.UUID;

public record ImportacionHistorialResponse(
    UUID id,
    String archivo,
    String usuario,
    int creados,
    int actualizados,
    int errores,
    Instant createdAt,
    /** Qué importador la hizo: ESTUDIANTES, CRM o LIBRO. */
    String origen
) {}
