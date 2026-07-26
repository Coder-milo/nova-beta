package com.novacrm.hv.dto;

public record ExperienciaDto(
    String cargo,
    String empresa,
    String fechaInicio,
    String fechaFin,
    boolean actual,
    String funciones
) {}
