package com.novacrm.dashboard.dto;

public record DashboardSummaryResponse(
        long totalEstudiantes,
        long nuevosEsteMes,
        double variacionMesPct,
        long activos,
        long graduados,
        long retirados,
        long enProceso,
        long totalProyectos,
        // Placeholders hasta que existan los módulos de Documentos y Hojas de Vida.
        long documentosPendientes,
        long hvsPorGenerar
) {}
