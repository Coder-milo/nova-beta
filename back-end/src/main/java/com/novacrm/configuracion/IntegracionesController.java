package com.novacrm.configuracion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Estado de las integraciones externas, para la pantalla de configuracion.
 *
 * <p>Solo lectura y solo ADMIN. No hay endpoint para escribir credenciales a
 * proposito: viven en variables de entorno del servidor, que es donde tienen
 * que estar. Un formulario que las aceptara por HTTP tendria que guardarlas en
 * algun sitio y devolverlas para poder editarlas, y ahi empieza el problema.
 */
@RestController
@RequestMapping("/api/v1/configuracion/integraciones")
@Tag(name = "Configuracion", description = "Estado de las integraciones externas")
public class IntegracionesController {

    private final IntegracionesService integracionesService;

    public IntegracionesController(IntegracionesService integracionesService) {
        this.integracionesService = integracionesService;
    }

    @GetMapping
    @Operation(summary = "Estado de cada integración externa. Nunca devuelve credenciales.")
    @PreAuthorize("hasRole('ADMIN')")
    public List<EstadoIntegracion> listar() {
        return integracionesService.listar();
    }

    @PostMapping("/{id}/probar")
    @Operation(summary = "Prueba de conexión en vivo, para las integraciones que la admiten")
    @PreAuthorize("hasRole('ADMIN')")
    public EstadoIntegracion.ResultadoPrueba probar(@PathVariable String id) {
        return integracionesService.probar(id);
    }
}
