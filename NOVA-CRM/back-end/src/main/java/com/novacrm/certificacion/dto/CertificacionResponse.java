package com.novacrm.certificacion.dto;

import java.util.UUID;

public record CertificacionResponse(
        UUID id,
        String nombre,
        String descripcion,
        Integer horasCurriculares,
        String habilidadesCubiertas,
        String textoCompartir,
        UUID programaId,
        String programaNombre,
        boolean activo
) {}
