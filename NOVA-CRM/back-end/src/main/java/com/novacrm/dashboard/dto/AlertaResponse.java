package com.novacrm.dashboard.dto;

public record AlertaResponse(
        String tipo,        // DATOS_FALTANTES, PROGRAMA_POR_FINALIZAR, ...
        String severidad,   // ALTA, MEDIA, BAJA
        String titulo,
        String detalle,
        String referenciaId // id del recurso relacionado, si aplica
) {}
