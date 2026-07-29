package com.novacrm.dashboard.dto;

import java.util.List;

public record DashboardChartsResponse(
        List<PuntoDato> distribucionEstado,      // torta: Activos/Graduados/Retirados/En proceso
        List<PuntoDato> historicoIngresos,       // líneas: ingresos por mes (año actual)
        List<PuntoDato> estudiantesPorProyecto,  // barras horizontales
        List<PuntoDato> empleabilidad            // dona: Empleado/Buscando/Sin info (con %)
) {}
