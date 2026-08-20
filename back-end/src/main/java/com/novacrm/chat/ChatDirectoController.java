package com.novacrm.chat;

import com.novacrm.chat.dto.ChatContactoResponse;
import com.novacrm.chat.dto.ChatDirectoMensajeRequest;
import com.novacrm.chat.dto.ChatDirectoMensajeResponse;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.http.ResponseEntity;
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
@PreAuthorize("isAuthenticated()")
public class ChatDirectoController {
    private final ChatDirectoService service;
    private final com.novacrm.documento.StorageService storageService;

    public ChatDirectoController(ChatDirectoService service,
                                 com.novacrm.documento.StorageService storageService) {
        this.service = service;
        this.storageService = storageService;
    }

    /** Con quien se ha hablado ya, para no tener que buscarlo por el nombre. */
    @GetMapping("/conversaciones")
    public List<com.novacrm.chat.dto.ChatConversacionResponse> conversaciones(Authentication auth) {
        return service.conversaciones(auth);
    }

    @GetMapping("/contactos")
    public List<ChatContactoResponse> contactos(
            @RequestParam(required = false, defaultValue = "") String q, Authentication auth) {
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

    /**
     * La foto de un compañero, para pintar su cara en la lista y la cabecera.
     *
     * <p>Con la regla del chat: del mismo proyecto y activo. El endpoint de la
     * ficha solo deja ver la propia, así que sin esto las caras de los demás
     * eran imágenes rotas.
     */
    @GetMapping("/directos/{contactoId}/foto")
    public ResponseEntity<byte[]> foto(@PathVariable UUID contactoId, Authentication auth) {
        String clave = service.claveDeFotoDe(contactoId, auth);
        if (clave == null || clave.isBlank()) {
            return ResponseEntity.notFound().build();
        }
        return com.novacrm.estudiante.FotoDePerfil.respuesta(clave, storageService.descargar(clave));
    }

    /** Aparta una conversación de la bandeja. Solo de quien lo pide. */
    @PostMapping("/directos/{contactoId}/archivar")
    public void archivar(@PathVariable UUID contactoId, Authentication auth) {
        service.archivar(contactoId, auth);
    }

    /** La devuelve a la bandeja. */
    @DeleteMapping("/directos/{contactoId}/archivar")
    public void desarchivar(@PathVariable UUID contactoId, Authentication auth) {
        service.desarchivar(contactoId, auth);
    }

    /**
     * Lo anterior a un mensaje, para subir por la conversación.
     *
     * <p>Abrirla trae los últimos doscientos; esto es el tramo de antes.
     */
    @GetMapping("/directos/{contactoId}/anteriores")
    public List<ChatDirectoMensajeResponse> anteriores(@PathVariable UUID contactoId,
                                                       @RequestParam UUID antesDe,
                                                       Authentication auth) {
        return service.anteriores(contactoId, antesDe, auth);
    }

    /** Busca dentro de una conversación. Mismo control que abrirla. */
    @GetMapping("/directos/{contactoId}/buscar")
    public List<ChatDirectoMensajeResponse> buscar(@PathVariable UUID contactoId,
                                                   @RequestParam String q,
                                                   Authentication auth) {
        return service.buscar(contactoId, q, auth);
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

    /**
     * El mismo envio, con archivos.
     *
     * <p>Va aparte y no sustituye al de JSON: el envio de solo texto es el que
     * se usa en cada tecla y no tiene por que pagar el coste de un multipart.
     *
     * @param duracion segundos que dice durar una nota de voz; se acota en el
     *                 servidor porque lo manda el navegador
     */
    @PostMapping(value = "/directos/{contactoId}/con-archivos",
            consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Enviar un mensaje con imagenes o notas de voz")
    public ChatDirectoMensajeResponse enviarConArchivos(
            @PathVariable UUID contactoId,
            @RequestParam(required = false) String contenido,
            @RequestParam(value = "archivos", required = false) java.util.List<org.springframework.web.multipart.MultipartFile> archivos,
            @RequestParam(required = false) Integer duracion,
            Authentication auth) {
        return service.enviar(contactoId, contenido, archivos, duracion, auth);
    }

    /**
     * Descarga un adjunto del chat.
     *
     * <p>El servicio comprueba que quien lo pide participa en esa conversacion,
     * asi que conocer el id no basta para bajarselo.
     */
    @GetMapping("/adjuntos/{adjuntoId}")
    @Operation(summary = "Descargar un archivo enviado por el chat")
    public org.springframework.http.ResponseEntity<byte[]> adjunto(@PathVariable UUID adjuntoId,
                                                                   Authentication auth) {
        var archivo = service.descargarAdjunto(adjuntoId, auth);
        return org.springframework.http.ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        com.novacrm.shared.NombreDeDescarga.enLinea(archivo.nombre()))
                .contentType(tipoAnalizable(archivo.contentType()))
                .body(archivo.contenido());
    }

    /** Un tipo ilegible no puede tumbar la descarga; se sirve como binario. */
    private static org.springframework.http.MediaType tipoAnalizable(String contentType) {
        try {
            return org.springframework.http.MediaType.parseMediaType(contentType);
        } catch (IllegalArgumentException e) {
            // InvalidMediaTypeException hereda de esta, asi que cubre las dos.
            return org.springframework.http.MediaType.APPLICATION_OCTET_STREAM;
        }
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
