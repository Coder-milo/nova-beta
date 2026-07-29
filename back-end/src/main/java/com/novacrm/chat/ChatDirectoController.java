package com.novacrm.chat;

import com.novacrm.chat.dto.ChatContactoResponse;
import com.novacrm.chat.dto.ChatDirectoMensajeRequest;
import com.novacrm.chat.dto.ChatDirectoMensajeResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/chats")
@PreAuthorize("hasRole('ESTUDIANTE')")
public class ChatDirectoController {
    private final ChatDirectoService service;

    public ChatDirectoController(ChatDirectoService service) { this.service = service; }

    @GetMapping("/contactos")
    public List<ChatContactoResponse> contactos(@RequestParam String q, Authentication auth) {
        return service.contactos(q, auth);
    }

    @GetMapping("/directos/{contactoId}")
    public List<ChatDirectoMensajeResponse> conversacion(@PathVariable UUID contactoId, Authentication auth) {
        return service.conversacion(contactoId, auth);
    }

    @PostMapping("/directos/{contactoId}")
    public ChatDirectoMensajeResponse enviar(@PathVariable UUID contactoId,
                                             @Valid @RequestBody ChatDirectoMensajeRequest request,
                                             Authentication auth) {
        return service.enviar(contactoId, request.contenido(), auth);
    }
}
