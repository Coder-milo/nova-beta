package com.novacrm.chat;

import com.novacrm.chat.dto.ChatContactoResponse;
import com.novacrm.chat.dto.ChatDirectoMensajeRequest;
import com.novacrm.chat.dto.ChatDirectoMensajeResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
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

    /** Con quien se ha hablado ya, para no tener que buscarlo por el nombre. */
    @GetMapping("/conversaciones")
    public List<com.novacrm.chat.dto.ChatConversacionResponse> conversaciones(Authentication auth) {
        return service.conversaciones(auth);
    }

    @GetMapping("/contactos")
    public List<ChatContactoResponse> contactos(@RequestParam String q, Authentication auth) {
        return service.contactos(q, auth);
    }

    /**
     * Reporta a un compañero por lo que escribió en el chat.
     *
     * <p>Guarda copia de lo último de esa conversación para que el equipo pueda
     * mirarlo aunque después se borre.
     */
    @PostMapping("/directos/{contactoId}/reportar")
    public void reportar(@PathVariable UUID contactoId,
                         @RequestBody(required = false) ReporteRequest cuerpo,
                         Authentication auth) {
        service.reportar(contactoId, cuerpo == null ? null : cuerpo.motivo(), auth);
    }

    /** El motivo es opcional: obligar a explicarse hace que no se reporte. */
    public record ReporteRequest(String motivo) {}

    /** Deja de recibir mensajes de esa persona, y de poder escribirle. */
    @PostMapping("/directos/{contactoId}/bloquear")
    public void bloquear(@PathVariable UUID contactoId, Authentication auth) {
        service.bloquear(contactoId, auth);
    }

    /** Deshace el bloqueo. Solo puede deshacerlo quien lo puso. */
    @DeleteMapping("/directos/{contactoId}/bloquear")
    public void desbloquear(@PathVariable UUID contactoId, Authentication auth) {
        service.desbloquear(contactoId, auth);
    }

    /** A quiénes bloqueó, para poder pintarlo y deshacerlo. */
    @GetMapping("/bloqueados")
    public List<UUID> bloqueados(Authentication auth) {
        return service.bloqueados(auth);
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

    @org.springframework.web.bind.annotation.PutMapping("/directos/mensajes/{mensajeId}")
    public ChatDirectoMensajeResponse editar(@PathVariable UUID mensajeId,
                                             @Valid @RequestBody ChatDirectoMensajeRequest request,
                                             Authentication auth) {
        return service.editar(mensajeId, request.contenido(), auth);
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/directos/mensajes/{mensajeId}")
    @org.springframework.web.bind.annotation.ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void borrar(@PathVariable UUID mensajeId, Authentication auth) {
        service.borrar(mensajeId, auth);
    }

    @PostMapping("/directos/mensajes/{mensajeId}/reenviar")
    public ChatDirectoMensajeResponse reenviar(@PathVariable UUID mensajeId,
                                               @RequestParam UUID destinoId,
                                               Authentication auth) {
        return service.reenviar(mensajeId, destinoId, auth);
    }
}
