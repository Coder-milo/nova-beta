package com.novacrm.programa.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ProgramaRequest(
        @NotBlank String nombre,
        String descripcion,
        Integer duracionDias,
        String fechaInicio,
        String fechaFin
) {}
