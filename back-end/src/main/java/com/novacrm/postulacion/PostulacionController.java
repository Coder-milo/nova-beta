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

    /**
     * Devuelve la vista recortada, no la de gestion.
     *
     * <p>Antes devolvia el mismo {@code PostulacionResponse} del panel, asi que
     * el estudiante recibia —en la respuesta, la pintara o no la pantalla— quien
     * de la institucion lleva su caso, la fecha del proximo seguimiento interno
     * y el correo de contacto del reclutador. Es el mismo corte que ya se hizo
     * en el listado de vacantes por el mismo motivo.
     */
    @GetMapping("/mias")
    @Operation(summary = "Mis postulaciones")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public List<com.novacrm.postulacion.dto.MiPostulacion> mias(Authentication auth) {
        var estudiante = ownershipService.obtenerEstudianteAutenticado(auth);
        return postulacionService.mias(estudiante.getId());
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
    public com.novacrm.postulacion.dto.MiPostulacion registrarPropia(
            @Valid @RequestBody CrearPostulacion datos, Authentication auth) {
        var estudiante = ownershipService.obtenerEstudianteAutenticado(auth);
        return postulacionService.crearPropia(estudiante.getId(), datos, auth.getName());
    }

    // ── Compartido ──────────────────────────────────────────────────────────

    /**
     * La vista de gestion, por eso ya no la alcanza un estudiante.
     *
     * <p>Admitia rol ESTUDIANTE con comprobacion de pertenencia, de modo que
     * cualquiera podia leer sus propias postulaciones <em>con los campos del
     * equipo dentro</em>: era la misma fuga que {@code /mias}, por otra puerta.
     * Un estudiante tiene {@code /mias}, que devuelve lo suyo recortado; esto es
     * la ficha que abre el equipo, y solo la usa el panel.
     */
    @GetMapping
    @Operation(summary = "Postulaciones de un estudiante (vista de gestion)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
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
     * Actualiza el seguimiento de una postulacion, desde el panel.
     *
     * <p>El estudiante tiene {@code PATCH /mias/{id}}, que hace lo mismo y le
     * devuelve su vista. Aqui devolvia el registro completo, asi que cambiar de
     * estado desde el portal le entregaba los campos de gestion aunque
     * {@code /mias} ya no lo hiciera: la fuga volvia por la respuesta del PATCH.
     */
    @PatchMapping("/{id}")
    @Operation(summary = "Actualizar el seguimiento de una postulacion (vista de gestion)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public PostulacionResponse actualizar(@PathVariable UUID id,
                                          @Valid @RequestBody ActualizarPostulacion cambios,
                                          Authentication auth) {
        return postulacionService.actualizar(id, cambios, auth.getName());
    }

    /**
     * El mismo cambio de estado, hecho por el propio estudiante.
     *
     * <p>Escribe en su historial de seguimiento y, si el proceso avanza de
     * verdad, mueve su tarjeta en el tablero del equipo. Lo que cambia respecto
     * al de arriba es solo lo que se devuelve.
     */
    @PatchMapping("/mias/{id}")
    @Operation(summary = "Actualizar el seguimiento de una postulacion propia")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public com.novacrm.postulacion.dto.MiPostulacion actualizarPropia(
            @PathVariable UUID id,
            @Valid @RequestBody ActualizarPostulacion cambios,
            Authentication auth) {
        var postulacion = postulacionService.obtener(id);
        ownershipService.verificarAccesoEstudiante(auth, postulacion.getEstudiante().getId());
        return postulacionService.actualizarPropia(id, cambios, auth.getName());
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
     * Las citas de un tramo de fechas.
     *
     * <p>Solo para el equipo: es la agenda de todos los participantes a la vez.
     * Un estudiante ve las suyas en {@code /mias}, que ya devuelve la cita
     * dentro de cada postulacion.
     */
    @GetMapping("/tablero")
    @Operation(summary = "Postulaciones vivas para el tablero por estado")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<PostulacionResponse> tablero(
            @RequestParam(required = false) UUID programaId) {
        return postulacionService.paraTablero(programaId);
    }

    @GetMapping("/agenda")
    @Operation(summary = "Entrevistas agendadas en un rango de fechas")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<PostulacionResponse> agenda(
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso =
                    org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate desde,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso =
                    org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate hasta) {
        if (hasta.isBefore(desde)) {
            throw new com.novacrm.exception.BusinessException("El rango de fechas esta invertido");
        }
        // Un rango abierto traeria la agenda entera a memoria; 92 dias cubren un
        // trimestre, que es el tramo mas largo que se consulta de una vez.
        if (desde.plusDays(92).isBefore(hasta)) {
            throw new com.novacrm.exception.BusinessException("El rango no puede pasar de 92 dias");
        }
        return postulacionService.agenda(desde, hasta);
    }

    @GetMapping("/agenda/sin-cerrar")
    @Operation(summary = "Entrevistas cuya hora paso y siguen agendadas")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<PostulacionResponse> entrevistasSinCerrar() {
        return postulacionService.entrevistasSinCerrar();
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
