package com.novacrm.ia.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ConsultaAsistenteDto(
        @NotBlank(message = "La pregunta no puede estar vacía")
        @Size(max = 500, message = "La pregunta no puede superar 500 caracteres")
        String pregunta,
        @Size(max = 120, message = "La ruta actual no puede superar 120 caracteres")
        String rutaActual
) {}
