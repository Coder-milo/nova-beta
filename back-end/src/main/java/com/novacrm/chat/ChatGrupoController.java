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
@PreAuthorize("isAuthenticated()")
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
        return com.novacrm.estudiante.FotoDePerfil.respuesta(clave, storageService.descargar(clave));
    }

    /** Lo anterior a un mensaje del grupo, para subir por la conversación. */
    @GetMapping("/{grupoId}/anteriores")
    public List<ChatGrupoService.GrupoMensajeResponse> anteriores(@PathVariable UUID grupoId,
                                                                  @RequestParam UUID antesDe,
                                                                  Authentication auth) {
        return service.anteriores(grupoId, antesDe, auth);
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

    /**
     * Escribe en el grupo.
     *
     * <p>El texto va en el cuerpo y no en la URL. Como parámetro acababa en los
     * registros del servidor, en los del proxy y en el historial del navegador:
     * lo que se escribe en un chat privado no puede quedar copiado en tres
     * sitios que nadie mira hasta que alguien los mira. Además, una URL tiene
     * límite de longitud, así que un mensaje largo fallaba con un 414 en vez de
     * con una explicación.
     *
     * <p>Es también como funciona el chat de dos, que ya usaba cuerpo.
     */
    @PostMapping("/{grupoId}/mensajes")
    @ResponseStatus(HttpStatus.CREATED)
    public ChatGrupoService.GrupoMensajeResponse enviarMensajeGrupo(
            @PathVariable UUID grupoId,
            @Valid @RequestBody MensajeDeGrupoRequest cuerpo,
            Authentication auth) {
        return service.enviarAMensajeGrupo(grupoId, cuerpo.contenido(), cuerpo.enRespuestaA(), auth);
    }

    /** Lo que se escribe en un grupo. */
    public record MensajeDeGrupoRequest(
            @jakarta.validation.constraints.NotBlank String contenido,
            UUID enRespuestaA) {}
}
