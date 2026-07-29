package com.novacrm.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChatDirectoMensajeRequest(
        @NotBlank @Size(max = 5000) String contenido) { }
