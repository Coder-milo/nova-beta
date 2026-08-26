package com.novacrm.hv.dto;

import java.util.List;

public record AdaptacionCvInglesResponse(
        String targetRole,
        String professionalSummary,
        String skills,
        List<ExperienciaDto> experiences,
        List<String> actionVerbsUsed,
        String suggestions
) {
}
