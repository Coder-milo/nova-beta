package com.novacrm.desarrollador;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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

    @GetMapping("/vacantes/conectores")
    public java.util.List<com.novacrm.scraper.dto.EstadoConectorDto> conectoresDeVacantes() {
        return diagnosticoService.conectoresDeVacantes();
    }

    @PostMapping("/vacantes/conectores/{fuente}/probar")
    public com.novacrm.scraper.dto.ResultadoPruebaFuenteDto probarConectorDeVacantes(
            @PathVariable String fuente) {
        return diagnosticoService.probarConectorDeVacantes(fuente);
    }

    @GetMapping("/vacantes/ejecuciones")
    public java.util.List<com.novacrm.scraper.dto.EjecucionDeScraping> ejecucionesDeVacantes() {
        return diagnosticoService.ejecucionesDeVacantes();
    }

    @PostMapping("/integraciones/{id}/probar")
    public com.novacrm.configuracion.EstadoIntegracion.ResultadoPrueba probarIntegracion(
            @PathVariable String id) {
        return diagnosticoService.probarIntegracion(id);
    }
}
