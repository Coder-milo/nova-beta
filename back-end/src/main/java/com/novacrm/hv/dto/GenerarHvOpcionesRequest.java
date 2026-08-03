package com.novacrm.hv.dto;

import java.util.List;
import java.util.UUID;

public record GenerarHvOpcionesRequest(
        UUID plantillaId,
        String idioma,
        List<String> seccionesExcluidas,
        List<String> camposExcluidos
) {
}
