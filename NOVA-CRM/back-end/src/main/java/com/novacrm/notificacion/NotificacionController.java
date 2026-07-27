package com.novacrm.notificacion;

import com.novacrm.auth.OwnershipService;
import com.novacrm.notificacion.dto.NotificacionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notificaciones")
@Tag(name = "Notificaciones", description = "Notificaciones del sistema")
public class NotificacionController {

    private final NotificacionService notificacionService;
    private final OwnershipService ownershipService;

    public NotificacionController(NotificacionService notificacionService, OwnershipService ownershipService) {
        this.notificacionService = notificacionService;
        this.ownershipService = ownershipService;
    }

    @GetMapping
    @Operation(summary = "Obtener notificaciones de un estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public Page<NotificacionResponse> obtener(@RequestParam UUID estudianteId,
                                       @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
                                       Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        return notificacionService.obtenerNotificaciones(estudianteId, pageable);
    }

    @GetMapping("/no-leidas")
    @Operation(summary = "Contar notificaciones no leidas")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public long contarNoLeidas(@RequestParam UUID estudianteId, Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        return notificacionService.contarNoLeidas(estudianteId);
    }

    @PutMapping("/{id}/leer")
    @Operation(summary = "Marcar notificacion como leida")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public void marcarLeida(@PathVariable UUID id, Authentication auth) {
        notificacionService.marcarLeida(id, auth);
    }

    @PostMapping("/anuncio")
    @Operation(summary = "Publicar un anuncio para los estudiantes (feria de empleo, convocatoria)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public java.util.Map<String, Object> publicarAnuncio(
            @jakarta.validation.Valid @RequestBody AnuncioRequest request) {
        int destinatarios = notificacionService.publicarAnuncio(
                request.titulo(), request.mensaje(), request.programaId());
        return java.util.Map.of(
                "destinatarios", destinatarios,
                "mensaje", destinatarios == 0
                        ? "No hay estudiantes activos a quienes avisar"
                        : "Anuncio enviado a " + destinatarios + " estudiante(s)");
    }

    /**
     * @param programaId limita el anuncio a un programa; nulo lo envia a todos
     */
    public record AnuncioRequest(
            @jakarta.validation.constraints.NotBlank(message = "El titulo es obligatorio")
            @jakarta.validation.constraints.Size(max = 500)
            String titulo,

            @jakarta.validation.constraints.NotBlank(message = "El mensaje es obligatorio")
            String mensaje,

            UUID programaId) {}
}
