package com.novacrm.perfil.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public record FormacionRequest(
        @NotBlank String tipo,
        @NotBlank String institucion,
        @NotBlank String programa,
        LocalDate fechaInicio,
        LocalDate fechaFin,
        String estado
) {}
