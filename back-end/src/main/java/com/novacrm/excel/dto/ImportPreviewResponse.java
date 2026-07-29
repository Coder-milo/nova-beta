package com.novacrm.excel.dto;

import java.util.List;

public record ImportPreviewResponse(
    int totalFilas,
    int validos,
    int nuevos,
    int actualizados,
    int conErrores,
    List<String> errores,
    List<String> advertencias
) {}
