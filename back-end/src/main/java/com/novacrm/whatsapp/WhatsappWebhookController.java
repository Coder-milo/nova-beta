package com.novacrm.whatsapp;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Webhook de WhatsApp Cloud API y bandeja de mensajes.
 *
 * <p>Los dos extremos de la ruta del webhook son públicos a propósito: los
 * llama Meta, no el navegador, y no pueden llevar sesión. La seguridad de esa
 * ruta es la verificación del token y la firma HMAC, no un JWT.
 */
@RestController
@RequestMapping("/api/v1/whatsapp")
@Tag(name = "WhatsApp", description = "Canal de WhatsApp Cloud API de cada programa")
public class WhatsappWebhookController {

    private final WhatsappWebhookService webhookService;
    private final WhatsappConfigService configService;

    public WhatsappWebhookController(WhatsappWebhookService webhookService,
                                     WhatsappConfigService configService) {
        this.webhookService = webhookService;
        this.configService = configService;
    }

    /** La verificación inicial que Meta hace al conectar el webhook. */
    @GetMapping("/webhook")
    @Operation(summary = "Verificación de suscripción del webhook (llama Meta)")
    public ResponseEntity<String> verificar(@RequestParam("hub.mode") String mode,
                                            @RequestParam("hub.verify_token") String verifyToken,
                                            @RequestParam("hub.challenge") String challenge) {
        String respuesta = webhookService.verificarSuscripcion(mode, verifyToken, challenge);
        return respuesta == null
                ? ResponseEntity.status(403).body("Token de verificación inválido")
                : ResponseEntity.ok(respuesta);
    }

    /** Los eventos de mensajes de Meta. */
    @PostMapping("/webhook")
    @Operation(summary = "Eventos de mensajes entrantes (llama Meta)")
    public ResponseEntity<Void> eventos(@RequestBody String body,
                                        @RequestHeader(value = "X-Hub-Signature-256", required = false) String firma) {
        webhookService.procesar(body, firma);
        return ResponseEntity.ok().build();
    }

    /** La conversación del programa, entrantes y salientes, de más nueva a más vieja. */
    @GetMapping("/{programaId}/mensajes")
    @Operation(summary = "Bandeja de mensajes de WhatsApp de un programa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<MensajeResponse> bandeja(Authentication auth, @PathVariable UUID programaId) {
        return configService.bandeja(auth, programaId);
    }

    /** Un mensaje de la bandeja, sin tocar las entidades. */
    public record MensajeResponse(
            UUID id,
            String tipo,
            String remitente,
            String texto,
            String estudiante,
            java.time.Instant fecha) {}
}
