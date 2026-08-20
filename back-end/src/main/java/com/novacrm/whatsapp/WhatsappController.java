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
    private final WhatsappAutomatizacionesService automatizacionesService;

    public WhatsappController(WhatsappConfigService configService,
                              WhatsappSender whatsappSender,
                              WhatsappAutomatizacionesService automatizacionesService) {
        this.configService = configService;
        this.whatsappSender = whatsappSender;
        this.automatizacionesService = automatizacionesService;
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

    @GetMapping("/{programaId}/automatizaciones/metricas")
    @Operation(summary = "Métricas de presupuesto y candidatos de automatización de WhatsApp")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public WhatsappAutomatizacionesService.MetricasPresupuesto metricas(@PathVariable UUID programaId) {
        return automatizacionesService.obtenerMetricasPresupuesto(programaId);
    }

    public record PeticionAutomatizacion(Integer dias, Boolean simulacion) {}

    @PostMapping("/{programaId}/automatizaciones/inactividad")
    @Operation(summary = "Ejecutar o simular nudges de WhatsApp por inactividad de postulación")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public WhatsappAutomatizacionesService.ResumenEjecucion ejecutarInactividad(
            @PathVariable UUID programaId,
            @RequestBody(required = false) PeticionAutomatizacion peticion) {
        int dias = peticion != null && peticion.dias() != null ? peticion.dias() : 7;
        boolean sim = peticion != null && peticion.simulacion() != null ? peticion.simulacion() : true;
        return automatizacionesService.ejecutarNudgeInactividad(programaId, dias, sim);
    }

    @PostMapping("/{programaId}/automatizaciones/resumen-semanal")
    @Operation(summary = "Ejecutar o simular resumen semanal de ofertas de WhatsApp")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public WhatsappAutomatizacionesService.ResumenEjecucion ejecutarResumenSemanal(
            @PathVariable UUID programaId,
            @RequestBody(required = false) PeticionAutomatizacion peticion) {
        boolean sim = peticion != null && peticion.simulacion() != null ? peticion.simulacion() : true;
        return automatizacionesService.ejecutarResumenSemanalVacantes(programaId, sim);
    }

    @PostMapping("/{programaId}/automatizaciones/seguimiento")
    @Operation(summary = "Ejecutar o simular check-in de seguimiento laboral por WhatsApp")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public WhatsappAutomatizacionesService.ResumenEjecucion ejecutarSeguimiento(
            @PathVariable UUID programaId,
            @RequestBody(required = false) PeticionAutomatizacion peticion) {
        int dias = peticion != null && peticion.dias() != null ? peticion.dias() : 30;
        boolean sim = peticion != null && peticion.simulacion() != null ? peticion.simulacion() : true;
        return automatizacionesService.ejecutarCheckInSeguimiento(programaId, dias, sim);
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
