package com.novacrm.desarrollador;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Endpoint de solo lectura de la consola técnica. */
@RestController
@RequestMapping("/api/v1/desarrollador")
@PreAuthorize("hasRole('DESARROLLADOR')")
public class DiagnosticoDesarrolladorController {

    private final DiagnosticoDesarrolladorService diagnosticoService;

    public DiagnosticoDesarrolladorController(DiagnosticoDesarrolladorService diagnosticoService) {
        this.diagnosticoService = diagnosticoService;
    }

    @GetMapping("/resumen")
    public DiagnosticoDesarrolladorResponse resumen() {
        return diagnosticoService.resumen();
    }
}
