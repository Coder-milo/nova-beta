package com.novacrm.seguimiento.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public record SeguimientoRequest(
        LocalDate fecha,
        @NotBlank String tipo,
        String responsable,
        String observacion,
        String proximaAccion,
        LocalDate fechaProxima,
        String estado
) {}
