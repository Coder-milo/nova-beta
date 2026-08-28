package com.novacrm.hv.dto;

import java.util.List;

public record AplicarAdaptacionInglesRequest(
        String nivelIngles,
        String targetRole,
        String professionalSummary,
        String skills,
        List<ExperienciaDto> experiences
) {
}
