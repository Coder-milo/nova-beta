package com.novacrm.programa.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record ProgramaRequest(
        @NotBlank String nombre,
        String descripcion,
        Integer duracionDias,
        String fechaInicio,
        String fechaFin,
        String cliente,
        String responsable,
        String observaciones,
        @Min(0) @Max(100) Integer porcentajeAvance
) {}
