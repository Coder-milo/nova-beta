package com.novacrm.perfil.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public record ExperienciaRequest(
        @NotBlank String empresa,
        @NotBlank String cargo,
        String ciudad,
        LocalDate fechaInicio,
        LocalDate fechaFin,
        boolean relacionada,
        String funciones,
        boolean actual
) {}
