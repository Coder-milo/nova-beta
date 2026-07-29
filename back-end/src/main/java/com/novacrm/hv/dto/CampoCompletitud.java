package com.novacrm.hv.dto;

public record CampoCompletitud(
    String placeholder,
    String label,
    boolean completo,
    String valorActual,
    String fuente
) {}
