package com.novacrm.dashboard;

import com.novacrm.dashboard.dto.AlertaResponse;
import com.novacrm.dashboard.dto.DashboardChartsResponse;
import com.novacrm.dashboard.dto.DashboardSummaryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/dashboard")
@Tag(name = "Dashboard", description = "KPIs, gráficos y alertas del panel")
@PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/summary")
    @Operation(summary = "KPIs del dashboard con variaciones temporales")
    public DashboardSummaryResponse summary() {
        return dashboardService.resumen();
    }

    @GetMapping("/charts")
    @Operation(summary = "Datasets de los gráficos del dashboard")
    public DashboardChartsResponse charts() {
        return dashboardService.graficos();
    }

    @GetMapping("/alerts")
    @Operation(summary = "Alertas dinámicas evaluadas en tiempo real")
    public List<AlertaResponse> alerts() {
        return dashboardService.alertas();
    }
}
