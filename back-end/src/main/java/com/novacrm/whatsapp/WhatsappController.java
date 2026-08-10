package com.novacrm.whatsapp;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Canal de WhatsApp por programa.
 *
 * <p>La lectura la puede hacer cualquiera con sesión (el portal del estudiante
 * necesita saber si su programa tiene WhatsApp para ofrecer el botón de
 * contacto), pero {@code WhatsappConfigService} comprueba antes que el
 * programa sea el suyo. La escritura es de ADMIN o COORDINADOR, y el token
 * solo viaja de ida: nunca se devuelve al frontend.
 */
@RestController
@RequestMapping("/api/v1/whatsapp")
@Tag(name = "WhatsApp", description = "Canal de WhatsApp Cloud API de cada programa")
public class WhatsappController {

    private final WhatsappConfigService configService;
    private final WhatsappSender whatsappSender;

    public WhatsappController(WhatsappConfigService configService,
                              WhatsappSender whatsappSender) {
        this.configService = configService;
        this.whatsappSender = whatsappSender;
    }

    /** El canal del programa del propio usuario. Para el portal del estudiante. */
    @GetMapping("/mio")
    @Operation(summary = "Canal de WhatsApp del programa del usuario autenticado")
    @PreAuthorize("isAuthenticated()")
    public CanalDeSoporteResponse mio(Authentication auth) {
        return configService.consultarElMio(auth);
    }

    @GetMapping("/{programaId}")
    @Operation(summary = "Canal de WhatsApp de un programa")
    @PreAuthorize("isAuthenticated()")
    public WhatsappResponse consultar(Authentication auth, @PathVariable UUID programaId) {
        return configService.consultar(auth, programaId);
    }

    @PutMapping("/{programaId}")
    @Operation(summary = "Guardar el canal de WhatsApp de un programa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public WhatsappResponse guardar(@PathVariable UUID programaId,
                                    @RequestBody WhatsappRequest request) {
        return configService.guardar(programaId, request);
    }

    /**
     * Envia un mensaje de texto al propio numero del negocio para comprobar que
     * el token y el phone_id funcionan. Es el único destino que Meta permite
     * sin plantilla aprobada para mensajes iniciados por el negocio.
     */
    @PostMapping("/{programaId}/probar")
    @Operation(summary = "Enviar mensaje de prueba al propio numero del negocio")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public WhatsappSender.Resultado probar(@PathVariable UUID programaId) {
        var canal = whatsappSender.activo(programaId);
        if (canal == null) {
            return WhatsappSender.Resultado.fallo(
                    "El canal no está activo: guarda el token y actívalo antes de probar");
        }
        var config = configService.leer(programaId);
        return whatsappSender.enviarTexto(programaId, config.numeroWhatsapp(),
                "¡Conexión verificada! Este es un mensaje de prueba de Nova CRM. "
                        + "El canal de WhatsApp de " + config.programaNombre() + " quedó listo.");
    }
}
