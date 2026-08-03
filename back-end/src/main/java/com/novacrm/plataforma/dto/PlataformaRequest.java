package com.novacrm.plataforma.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PlataformaRequest(
        @NotBlank String codigo,
        @NotBlank String nombre,
        @NotBlank @Size(max = 1000) String url,
        @Size(max = 1000) String iconoUrl
) {}