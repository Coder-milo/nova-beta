package com.novacrm.programa.dto;

import com.novacrm.programa.ProgramaEstado;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ProgramaResponse(
        UUID id,
        String nombre,
        String descripcion,
        Integer duracionDias,
        LocalDate fechaInicio,
        LocalDate fechaFin,
        ProgramaEstado estado,
        boolean activo,
        long totalEstudiantes,
        String cliente,
        String responsable,
        String observaciones,
        int porcentajeAvance,
        Instant createdAt
) {}
