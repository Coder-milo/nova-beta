package com.novacrm.busqueda;

import com.novacrm.busqueda.dto.BusquedaResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/buscar")
@Tag(name = "Busqueda", description = "Busqueda global de estudiantes, programas y documentos")
public class BusquedaController {

    private final BusquedaService busquedaService;

    public BusquedaController(BusquedaService busquedaService) {
        this.busquedaService = busquedaService;
    }

    @GetMapping
    @Operation(summary = "Busqueda global por texto")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public BusquedaResponse buscar(@RequestParam String q) {
        if (q == null || q.trim().length() < 2) {
            return new BusquedaResponse(List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
        }
        return busquedaService.buscar(q.trim());
    }
}
