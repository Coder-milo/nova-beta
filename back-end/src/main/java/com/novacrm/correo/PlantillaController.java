package com.novacrm.correo;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Plantillas de correo.
 *
 * <p>Todo el modulo es de COORDINADOR o ADMIN: son los dos unicos roles de
 * gestion que existen. Enviar va aparte y simula por defecto.
 */
@RestController
@RequestMapping("/api/v1/plantillas-correo")
@Tag(name = "Plantillas de correo",
     description = "Editor de plantillas con variables y envio masivo")
public class PlantillaController {

    private final PlantillaService plantillaService;

    public PlantillaController(PlantillaService plantillaService) {
        this.plantillaService = plantillaService;
    }

    @GetMapping
    @Operation(summary = "Listar plantillas")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<PlantillaDtos.Respuesta> listar() {
        return plantillaService.listar();
    }

    @GetMapping("/variables")
    @Operation(summary = "Variables disponibles para escribir en una plantilla")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<PlantillaDtos.VariableDisponible> variables() {
        return plantillaService.variables();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener una plantilla")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public PlantillaDtos.Respuesta obtener(@PathVariable UUID id) {
        return plantillaService.obtener(id);
    }

    @PostMapping
    @Operation(summary = "Crear una plantilla")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public PlantillaDtos.Respuesta crear(@RequestBody PlantillaDtos.Guardar peticion) {
        return plantillaService.guardar(null, peticion);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar una plantilla")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public PlantillaDtos.Respuesta actualizar(@PathVariable UUID id,
                                              @RequestBody PlantillaDtos.Guardar peticion) {
        return plantillaService.guardar(id, peticion);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar una plantilla")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> eliminar(@PathVariable UUID id) {
        plantillaService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Como queda el correo con datos de ejemplo.
     *
     * <p>Es POST y no GET porque recibe la plantilla que se esta escribiendo,
     * que todavia no esta guardada: el editor previsualiza mientras se teclea.
     */
    @PostMapping("/previsualizar")
    @Operation(summary = "Previsualizar sin guardar")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public PlantillaDtos.Previsualizacion previsualizar(@RequestBody PlantillaDtos.Guardar peticion) {
        return plantillaService.previsualizar(peticion);
    }

    @GetMapping("/sistema/defaults")
    @Operation(summary = "Listar plantillas predeterminadas del sistema")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<PlantillaDtos.PlantillaDefecto> defaultsSistema() {
        return plantillaService.obtenerDefectos();
    }

    /**
     * Enviar un correo de prueba directo con variables simuladas.
     */
    @PostMapping("/enviar-prueba")
    @Operation(summary = "Enviar un correo de prueba directo")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public PlantillaDtos.ResumenEnvio enviarPrueba(@RequestBody PlantillaDtos.EnviarPruebaRequest peticion) {
        return plantillaService.enviarPrueba(peticion);
    }

    /**
     * Restaura una plantilla a sus valores predeterminados de fábrica.
     */
    @PostMapping("/{id}/restaurar-defecto")
    @Operation(summary = "Restaurar una plantilla a sus valores de fábrica del sistema")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public PlantillaDtos.Respuesta restaurarDefecto(@PathVariable UUID id,
                                                    @RequestParam(required = false) String tipo) {
        return plantillaService.restaurarDefecto(id, tipo);
    }

    /**
     * Obtiene los valores predeterminados de fábrica para un tipo de correo del sistema.
     */
    @PostMapping("/restaurar-defecto/{tipo}")
    @Operation(summary = "Obtener valores de fábrica para un tipo de correo del sistema")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public PlantillaDtos.PlantillaDefecto restaurarDefectoPorTipo(@PathVariable String tipo) {
        return plantillaService.restaurarDefectoPorTipo(tipo);
    }

    /**
     * Envio masivo. <strong>Simula por defecto</strong>: mandar un correo a 108
     * personas no debe ser el efecto de una llamada hecha por descuido.
     */
    @PostMapping("/{id}/enviar")
    @Operation(summary = "Enviar una plantilla a los estudiantes")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public PlantillaDtos.ResumenEnvio enviar(@PathVariable UUID id,
                                             @RequestBody(required = false) PlantillaDtos.EnviarRequest peticion) {
        return plantillaService.enviar(id,
                peticion == null ? new PlantillaDtos.EnviarRequest(null, null) : peticion);
    }
}
