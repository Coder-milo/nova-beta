package com.novacrm.actividad.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record ActividadResponse(
        UUID id,
        UUID programaId,
        String programaNombre,
        String nombre,
        LocalDate fecha,
        LocalTime hora,
        String descripcion,
        String categoria,
        String responsable,
        String estado
) {}
