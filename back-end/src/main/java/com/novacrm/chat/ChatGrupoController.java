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

    public ChatGrupoController(ChatGrupoService service) {
        this.service = service;
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
