package com.novacrm.ia.dto;

import jakarta.validation.constraints.NotBlank;

public record ConsultaAsistenteDto(
        @NotBlank(message = "La pregunta no puede estar vacía")
        String pregunta,
        String rutaActual
) {}
