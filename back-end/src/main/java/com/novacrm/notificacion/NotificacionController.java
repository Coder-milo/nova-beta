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
    private final AnuncioMediaService anuncioMediaService;

    public NotificacionController(NotificacionService notificacionService, OwnershipService ownershipService,
                                 AnuncioMediaService anuncioMediaService) {
        this.notificacionService = notificacionService;
        this.ownershipService = ownershipService;
        this.anuncioMediaService = anuncioMediaService;
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
        String mediaUrl = urlSegura(request.mediaUrl());
        int destinatarios = notificacionService.publicarAnuncio(
                request.titulo(), request.mensaje(), request.programaId(), mediaUrl, normalizarTipoMedia(request.mediaTipo(), mediaUrl));
        return java.util.Map.of(
                "destinatarios", destinatarios,
                "mensaje", destinatarios == 0
                        ? "No hay estudiantes activos a quienes avisar"
                        : "Anuncio enviado a " + destinatarios + " estudiante(s)");
    }

    @PostMapping(value = "/anuncio/adjunto", consumes = "multipart/form-data")
    @Operation(summary = "Subir un poster o video para un anuncio")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public AnuncioMediaService.Recurso subirAdjunto(@RequestParam("archivo") org.springframework.web.multipart.MultipartFile archivo) {
        return anuncioMediaService.guardar(archivo);
    }

    /**
     * Los adjuntos de anuncios son publicos por diseño: un aviso por correo o
     * una notificacion puede abrirse sin que el navegador sepa adjuntar un JWT
     * a una etiqueta img/video. La clave queda restringida a anuncios/.
     */
    @GetMapping("/adjunto/**")
    @Operation(summary = "Servir un recurso de anuncio")
    public org.springframework.http.ResponseEntity<byte[]> descargarAdjunto(jakarta.servlet.http.HttpServletRequest request) {
        String prefijo = "/api/v1/notificaciones/adjunto/";
        String key = request.getRequestURI().substring(request.getRequestURI().indexOf(prefijo) + prefijo.length());
        key = AnuncioMediaService.claveSegura(java.net.URLDecoder.decode(key, java.nio.charset.StandardCharsets.UTF_8));
        String extension = key.substring(key.lastIndexOf('.') + 1).toLowerCase(java.util.Locale.ROOT);
        String contentType = switch (extension) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            case "gif" -> "image/gif";
            case "webm" -> "video/webm";
            case "mov" -> "video/quicktime";
            default -> "video/mp4";
        };
        return org.springframework.http.ResponseEntity.ok()
                .header("Content-Type", contentType)
                .header("Cache-Control", "public, max-age=86400")
                .body(anuncioMediaService.contenido(key));
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

            UUID programaId,

            @jakarta.validation.constraints.Size(max = 2048)
            String mediaUrl,

            @jakarta.validation.constraints.Size(max = 20)
            String mediaTipo) {}

    private String urlSegura(String url) {
        if (url == null || url.isBlank()) return null;
        String limpia = url.trim();
        if (!(limpia.startsWith("https://") || limpia.startsWith("http://"))) {
            throw new com.novacrm.exception.BusinessException("El enlace del anuncio debe empezar por http:// o https://");
        }
        return limpia;
    }

    private String normalizarTipoMedia(String tipo, String url) {
        if (url == null) return null;
        if ("IMAGE".equalsIgnoreCase(tipo) || "VIDEO".equalsIgnoreCase(tipo)) return tipo.toUpperCase(java.util.Locale.ROOT);
        return "LINK";
    }
}
