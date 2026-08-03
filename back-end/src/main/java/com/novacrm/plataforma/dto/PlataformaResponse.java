package com.novacrm.plataforma.dto;

import java.util.UUID;

public record PlataformaResponse(
        UUID id,
        String codigo,
        String nombre,
        String url,
        String iconoUrl,
        boolean activo
) {}