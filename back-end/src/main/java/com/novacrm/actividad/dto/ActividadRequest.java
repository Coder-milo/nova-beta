package com.novacrm.actividad.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record ActividadRequest(
        @NotBlank String nombre,
        @NotNull LocalDate fecha,
        LocalTime hora,
        String descripcion,
        String categoria,
        String responsable,
        String estado,
        UUID programaId
) {}
