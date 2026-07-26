package com.novacrm.hv.dto;

import java.util.List;

public record SeccionCompletitud(
    String id,
    String titulo,
    int porcentaje,
    int camposCompletos,
    int camposTotales,
    List<CampoCompletitud> campos
) {}
