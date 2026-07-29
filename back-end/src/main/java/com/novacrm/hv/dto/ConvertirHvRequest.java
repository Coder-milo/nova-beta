package com.novacrm.hv.dto;

import java.util.List;

public record ConvertirHvRequest(
    DatosHvDto datos,
    String idioma,
    List<String> seccionesExcluidas,
    List<String> camposExcluidos
) {}
