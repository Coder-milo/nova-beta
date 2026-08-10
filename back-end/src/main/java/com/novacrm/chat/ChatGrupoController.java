package com.novacrm.chat;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/chats/grupos")
@PreAuthorize("hasRole('ESTUDIANTE')")
public class ChatGrupoController {

    private final ChatGrupoService service;
    private final com.novacrm.documento.StorageService storageService;

    public ChatGrupoController(ChatGrupoService service,
                               com.novacrm.documento.StorageService storageService) {
        this.service = service;
        this.storageService = storageService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ChatGrupoService.GrupoResponse crearGrupo(@Valid @RequestBody ChatGrupoService.CrearGrupoRequest request, Authentication auth) {
        return service.crearGrupo(request, auth);
    }

    @GetMapping
    public List<ChatGrupoService.GrupoResponse> misGrupos(Authentication auth) {
        return service.misGrupos(auth);
    }

    /** La foto del grupo. Solo la ven sus miembros. */
    @GetMapping("/{grupoId}/foto")
    public org.springframework.http.ResponseEntity<byte[]> foto(@PathVariable UUID grupoId,
                                                                Authentication auth) {
        String clave = service.claveDeFotoDelGrupo(grupoId, auth);
        if (clave == null || clave.isBlank()) {
            return org.springframework.http.ResponseEntity.notFound().build();
        }
        return org.springframework.http.ResponseEntity.ok()
                .contentType(com.novacrm.estudiante.FotoDePerfil.tipoPorExtension(clave))
                .body(storageService.descargar(clave));
    }

    /** Busca dentro del grupo. Solo quien pertenece. */
    @GetMapping("/{grupoId}/buscar")
    public List<ChatGrupoService.GrupoMensajeResponse> buscar(@PathVariable UUID grupoId,
                                                              @RequestParam String q,
                                                              Authentication auth) {
        return service.buscar(grupoId, q, auth);
    }

    /** Quién está en el grupo. Solo lo ven sus miembros. */
    @GetMapping("/{grupoId}/miembros")
    public List<ChatGrupoService.MiembroResponse> miembros(@PathVariable UUID grupoId,
                                                           Authentication auth) {
        return service.miembros(grupoId, auth);
    }

    @PostMapping("/{grupoId}/miembros")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void agregarMiembros(@PathVariable UUID grupoId,
                                @RequestBody List<UUID> estudianteIds,
                                Authentication auth) {
        service.agregarMiembros(grupoId, estudianteIds, auth);
    }

    /**
     * Reporta a alguien del grupo por lo que escribió en él.
     *
     * <p>Se reporta a una persona, no al grupo: cerrarlo por lo que escribió
     * uno castiga a todos los demás, que no hicieron nada.
     */
    @PostMapping("/{grupoId}/miembros/{estudianteId}/reportar")
    public void reportar(@PathVariable UUID grupoId, @PathVariable UUID estudianteId,
                         @RequestBody(required = false) ReporteRequest cuerpo,
                         Authentication auth) {
        service.reportar(grupoId, estudianteId, cuerpo == null ? null : cuerpo.motivo(), auth);
    }

    /** El motivo es opcional: obligar a explicarse hace que no se reporte. */
    public record ReporteRequest(String motivo) {}

    /** Salir del grupo. Si sale el último, el grupo se va con él. */
    @DeleteMapping("/{grupoId}/miembros/yo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void salir(@PathVariable UUID grupoId, Authentication auth) {
        service.salir(grupoId, auth);
    }

    /** Sacar a alguien del grupo. Solo un administrador. */
    @DeleteMapping("/{grupoId}/miembros/{estudianteId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void expulsar(@PathVariable UUID grupoId, @PathVariable UUID estudianteId,
                         Authentication auth) {
        service.expulsar(grupoId, estudianteId, auth);
    }

    @GetMapping("/{grupoId}/mensajes")
    public List<ChatGrupoService.GrupoMensajeResponse> mensajesDelGrupo(@PathVariable UUID grupoId, Authentication auth) {
        return service.mensajesDelGrupo(grupoId, auth);
    }

    @PostMapping("/{grupoId}/mensajes")
    @ResponseStatus(HttpStatus.CREATED)
    public ChatGrupoService.GrupoMensajeResponse enviarMensajeGrupo(
            @PathVariable UUID grupoId,
            @RequestParam String contenido,
            @RequestParam(required = false) UUID enRespuestaA,
            Authentication auth) {
        return service.enviarAMensajeGrupo(grupoId, contenido, enRespuestaA, auth);
    }
}
