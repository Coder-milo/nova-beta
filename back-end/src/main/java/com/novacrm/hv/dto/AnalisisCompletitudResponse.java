package com.novacrm.hv.dto;

import java.util.List;
import java.util.Map;

public record AnalisisCompletitudResponse(
    String templateName,
    int porcentajeTotal,
    List<SeccionCompletitud> secciones,
    List<String> recomendaciones,
    Map<String, Object> datosEstudiante
) {}
