package com.novacrm.mensaje;

import com.novacrm.mensaje.dto.MensajeRequest;
import com.novacrm.mensaje.dto.MensajeResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mensajes")
public class MensajeEstudianteController {
    private final MensajeEstudianteService service;

    public MensajeEstudianteController(MensajeEstudianteService service) { this.service = service; }

    @GetMapping("/mios")
    @PreAuthorize("hasRole('ESTUDIANTE')")
    public List<MensajeResponse> mios(Authentication auth) { return service.mios(auth); }

    @PostMapping(value = "/mios", consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('ESTUDIANTE')")
    public MensajeResponse crear(@Valid @RequestBody MensajeRequest request, Authentication auth) {
        return service.crear(request, auth);
    }

    @PostMapping(value = "/mios", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ESTUDIANTE')")
    public MensajeResponse crearConAdjuntos(@RequestParam String asunto,
                                            @RequestParam(required = false) String contenido,
                                            @RequestParam(value = "archivos", required = false) List<MultipartFile> archivos,
                                            Authentication auth) {
        return service.crear(asunto, contenido, archivos, auth);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    public List<MensajeResponse> listarTodos() { return service.listarTodos(); }

    @PutMapping(value = "/{id}/respuesta", consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    public MensajeResponse responder(@PathVariable UUID id,
                                     @RequestBody @Valid RespuestaRequest request,
                                     Authentication auth) {
        return service.responder(id, request.respuesta(), auth);
    }

    @PutMapping(value = "/{id}/respuesta", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    public MensajeResponse responderConAdjuntos(@PathVariable UUID id,
                                                @RequestParam(required = false) String respuesta,
                                                @RequestParam(value = "archivos", required = false) List<MultipartFile> archivos,
                                                Authentication auth) {
        return service.responder(id, respuesta, archivos, auth);
    }

    @PostMapping(value = "/estudiantes/{estudianteId}", consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    public MensajeResponse enviarAlEstudiante(@PathVariable UUID estudianteId,
                                               @RequestBody @Valid RespuestaRequest request,
                                               Authentication auth) {
        return service.enviarAlEstudiante(estudianteId, request.respuesta(), List.of(), auth);
    }

    @PostMapping(value = "/estudiantes/{estudianteId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    public MensajeResponse enviarAlEstudianteConAdjuntos(@PathVariable UUID estudianteId,
                                                           @RequestParam(required = false) String respuesta,
                                                           @RequestParam(value = "archivos", required = false) List<MultipartFile> archivos,
                                                           Authentication auth) {
        return service.enviarAlEstudiante(estudianteId, respuesta, archivos, auth);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR')")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable UUID id) {
        service.eliminar(id);
    }

    // ── Conversación por turnos ─────────────────────────────────────────────
    //
    // Conviven con los endpoints de arriba a propósito: aquéllos siguen
    // sirviendo a la bandeja actual mientras la interfaz se pasa a los turnos.
    // El acceso lo decide el servicio con la misma comprobación que el resto
    // del portal —el estudiante sólo alcanza sus hilos, el equipo cualquiera—,
    // así que aquí basta con exigir sesión.

    @GetMapping("/{id}/turnos")
    @PreAuthorize("isAuthenticated()")
    public List<com.novacrm.mensaje.dto.MensajeTurnoResponse> turnos(@PathVariable UUID id,
                                                                     Authentication auth) {
        return service.turnos(id, auth);
    }

    @PostMapping(value = "/{id}/turnos", consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("isAuthenticated()")
    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public com.novacrm.mensaje.dto.MensajeTurnoResponse escribir(
            @PathVariable UUID id,
            @Valid @RequestBody TurnoRequest request,
            Authentication auth) {
        return service.escribirEnHilo(id, request.contenido(), request.enRespuestaA(), List.of(), auth);
    }

    @PostMapping(value = "/{id}/turnos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public com.novacrm.mensaje.dto.MensajeTurnoResponse escribirConAdjuntos(
            @PathVariable UUID id,
            @RequestParam(required = false) String contenido,
            @RequestParam(required = false) UUID enRespuestaA,
            @RequestParam(required = false) List<MultipartFile> archivos,
            Authentication auth) {
        return service.escribirEnHilo(id, contenido, enRespuestaA,
                archivos == null ? List.of() : archivos, auth);
    }

    /**
     * Pone o quita el emoji de quien llama sobre un turno.
     *
     * <p>Devuelve el recuento ya resuelto para ese turno, de modo que la
     * interfaz no tenga que recargar el hilo entero para repintar un botón.
     */
    @PostMapping("/turnos/{turnoId}/reacciones")
    @PreAuthorize("isAuthenticated()")
    public List<com.novacrm.mensaje.dto.MensajeTurnoResponse.ReaccionResumen> alternarReaccion(
            @PathVariable UUID turnoId,
            @RequestParam String emoji,
            Authentication auth) {
        return service.alternarReaccion(turnoId, emoji, auth);
    }

    /** @param enRespuestaA turno citado; nulo si es una intervención suelta. */
    public record TurnoRequest(
            @Size(max = 5000, message = "El mensaje no puede superar 5000 caracteres")
            String contenido,
            UUID enRespuestaA) { }

    @GetMapping("/adjuntos/{id}/archivo")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> descargarAdjunto(@PathVariable UUID id, Authentication auth) {
        var archivo = service.descargarAdjunto(id, auth);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + nombreParaCabecera(archivo.nombre()) + "\"")
                .contentType(mediaType(archivo.contentType()))
                .body(archivo.contenido());
    }

    private static MediaType mediaType(String contentType) {
        try {
            return MediaType.parseMediaType(contentType);
        } catch (IllegalArgumentException ignored) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    private static String nombreParaCabecera(String nombre) {
        return nombre.replaceAll("[\\r\\n\\\"]", "_");
    }

    public record RespuestaRequest(@NotBlank @Size(max = 5000) String respuesta) { }
}
