package com.novacrm.hv.dto;

import java.util.List;

public record ExtraccionResponse(
    List<CampoExtraidoDto> campos,
    String textoDetectado,
    DatosHvDto datosEstructurados
) {}

