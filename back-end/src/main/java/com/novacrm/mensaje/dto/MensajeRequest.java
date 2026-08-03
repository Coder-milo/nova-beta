package com.novacrm.mensaje.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MensajeRequest(
        @NotBlank @Size(max = 160) String asunto,
        @NotBlank @Size(max = 5000) String contenido) {
}
