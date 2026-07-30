package com.novacrm.hv.dto;

public record ExperienciaDto(
    String cargo,
    String empresa,
    String ciudad,
    String fechaInicio,
    String fechaFin,
    boolean relacionada,
    boolean actual,
    String funciones
) {}
