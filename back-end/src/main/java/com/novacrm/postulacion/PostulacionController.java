package com.novacrm.postulacion;

import com.novacrm.auth.OwnershipService;
import com.novacrm.postulacion.dto.PostulacionDtos.ActualizarPostulacion;
import com.novacrm.postulacion.dto.PostulacionDtos.CrearPostulacion;
import com.novacrm.postulacion.dto.PostulacionDtos.PostulacionResponse;
import com.novacrm.postulacion.dto.PostulacionDtos.ResumenPostulaciones;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Postulaciones. Es el modulo que el estudiante toca desde su cuenta.
 *
 * <p>Cada endpoint pasa por {@code OwnershipService}: un estudiante solo ve y
 * mueve las suyas. Se comprueba aqui ademas de en {@code SecurityConfig} porque
 * las reglas por URL no distinguen de quien es la fila, solo quien pregunta.
 */
@RestController
@RequestMapping("/api/v1/postulaciones")
@Tag(name = "Postulaciones", description = "Seguimiento de las postulaciones de cada participante")
public class PostulacionController {

    private final PostulacionService postulacionService;
    private final OwnershipService ownershipService;

    public PostulacionController(PostulacionService postulacionService,
                                 OwnershipService ownershipService) {
        this.postulacionService = postulacionService;
        this.ownershipService = ownershipService;
    }

    // ── Lo que usa el estudiante ────────────────────────────────────────────

    @GetMapping("/mias")
    @Operation(summary = "Mis postulaciones")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public List<PostulacionResponse> mias(Authentication auth) {
        var estudiante = ownershipService.obtenerEstudianteAutenticado(auth);
        return postulacionService.deEstudiante(estudiante.getId());
    }

    @GetMapping("/mias/resumen")
    @Operation(summary = "Cifras de mis postulaciones")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public ResumenPostulaciones miResumen(Authentication auth) {
        var estudiante = ownershipService.obtenerEstudianteAutenticado(auth);
        return postulacionService.resumen(estudiante.getId());
    }

    /**
     * Registra una postulacion propia.
     *
     * <p>El {@code estudianteId} del cuerpo se ignora a proposito: se toma del
     * token. Si se leyera del cuerpo, un estudiante podria anotarle
     * postulaciones a otro con solo cambiar un campo del JSON.
     */
    @PostMapping("/mias")
    @Operation(summary = "Registrar una postulacion propia")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public PostulacionResponse registrarPropia(@Valid @RequestBody CrearPostulacion datos,
                                               Authentication auth) {
        var estudiante = ownershipService.obtenerEstudianteAutenticado(auth);
        return postulacionService.crear(estudiante.getId(), datos, auth.getName(), true);
    }

    // ── Compartido ──────────────────────────────────────────────────────────

    @GetMapping
    @Operation(summary = "Postulaciones de un estudiante")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public List<PostulacionResponse> deEstudiante(@RequestParam UUID estudianteId, Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        return postulacionService.deEstudiante(estudianteId);
    }

    @PostMapping
    @Operation(summary = "Registrar una postulacion")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public PostulacionResponse crear(@Valid @RequestBody CrearPostulacion datos, Authentication auth) {
        return postulacionService.crear(datos.estudianteId(), datos, auth.getName(), false);
    }

    /**
     * Actualiza el seguimiento de una postulacion.
     *
     * <p>Lo puede hacer el propio estudiante. El cambio de estado escribe en su
     * historial de seguimiento y, si el proceso avanza de verdad, mueve su
     * tarjeta en el tablero del equipo.
     */
    @PatchMapping("/{id}")
    @Operation(summary = "Actualizar el seguimiento de una postulacion")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public PostulacionResponse actualizar(@PathVariable UUID id,
                                          @Valid @RequestBody ActualizarPostulacion cambios,
                                          Authentication auth) {
        var postulacion = postulacionService.obtener(id);
        ownershipService.verificarAccesoEstudiante(auth, postulacion.getEstudiante().getId());
        return postulacionService.actualizar(id, cambios, auth.getName());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar una postulacion")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public Map<String, String> eliminar(@PathVariable UUID id, Authentication auth) {
        var postulacion = postulacionService.obtener(id);
        ownershipService.verificarAccesoEstudiante(auth, postulacion.getEstudiante().getId());
        postulacionService.eliminar(id);
        return Map.of("mensaje", "Postulacion eliminada");
    }

    /**
     * Las que alguien marco como contratado y el equipo no ha verificado.
     *
     * <p>Es la bandeja de entrada del coordinador: un estudiante diciendo que
     * lo contrataron es una noticia que hay que confirmar con contrato y
     * salario antes de contarla como colocacion.
     */
    @GetMapping("/pendientes-de-confirmar")
    @Operation(summary = "Contratados sin colocacion registrada")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<PostulacionResponse> pendientesDeConfirmar() {
        return postulacionService.pendientesDeConfirmar();
    }

    @GetMapping("/estados")
    @Operation(summary = "Estados posibles de una postulacion")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public List<Map<String, Object>> estados() {
        return java.util.Arrays.stream(EstadoPostulacion.values())
                .map(e -> Map.<String, Object>of(
                        "valor", e.name(),
                        "etiqueta", e.getEtiqueta(),
                        "esFinal", e.esFinal()))
                .toList();
    }
}
