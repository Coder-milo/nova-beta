package com.novacrm.vista;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Vistas guardadas de las listas.
 *
 * <p>Solo para el equipo. Un estudiante ve unicamente lo suyo y una empresa
 * solo sus candidatos: en ninguno de los dos casos hay una lista lo bastante
 * grande como para que filtrarla merezca guardarse.
 */
@RestController
@RequestMapping("/api/v1/vistas")
@Tag(name = "Vistas guardadas", description = "Combinaciones de filtros con nombre")
@PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
public class VistaGuardadaController {

    private final VistaGuardadaService servicio;

    public VistaGuardadaController(VistaGuardadaService servicio) {
        this.servicio = servicio;
    }

    public record GuardarVista(
            @NotNull(message = "Falta el modulo") ModuloDeVista modulo,
            @NotBlank(message = "La vista necesita un nombre")
            @Size(max = 120) String nombre,
            @Size(max = 4000) String filtros,
            boolean compartida) {}

    @GetMapping
    @Operation(summary = "Vistas que puedo abrir en esa lista: las mias y las compartidas")
    public List<VistaGuardadaService.VistaResponse> listar(@RequestParam ModuloDeVista modulo,
                                                           Authentication auth) {
        return servicio.listar(modulo, auth.getName());
    }

    @PostMapping
    @Operation(summary = "Guardar una vista; repetir el nombre sobrescribe la propia")
    public VistaGuardadaService.VistaResponse guardar(@Valid @RequestBody GuardarVista datos,
                                                      Authentication auth) {
        return servicio.guardar(datos.modulo(), datos.nombre(), datos.filtros(),
                datos.compartida(), auth.getName());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Borrar una vista propia")
    public Map<String, String> eliminar(@PathVariable UUID id, Authentication auth) {
        servicio.eliminar(id, auth.getName());
        return Map.of("mensaje", "Vista eliminada");
    }
}
