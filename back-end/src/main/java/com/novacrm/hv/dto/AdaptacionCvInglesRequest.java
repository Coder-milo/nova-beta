package com.novacrm.hv.dto;

import java.util.List;

public record AdaptacionCvInglesRequest(
        String cargoObjetivo,
        String perfilProfesional,
        String competencias,
        List<ExperienciaDto> experiencias,
        String nivelIngles
) {
}
