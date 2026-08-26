package com.novacrm.correo;

import com.novacrm.config.EmailService;
import com.novacrm.exception.BusinessException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Ver los correos automáticos antes de que salgan y enviar pruebas en vivo.
 *
 * <p>El envío a estudiantes es masivo y de una sola pasada: 107 correos de
 * activación se mandan de golpe y no hay forma de retirarlos. Sin poder mirar
 * antes cómo queda, los fallos que se descubren son siempre los mismos —el logo
 * del programa no carga, el color no contrasta con el texto del botón, el pie
 * quedó con la marca de otro cliente— y se descubren cuando ya los recibió todo
 * el mundo.
 *
 * <p>El HTML sale de {@link CorreosDelSistema}, el mismo que usa el envío real.
 * Una previsualización que rearma el correo por su cuenta miente en cuanto
 * alguien toca uno de los dos lados.
 */
@RestController
@RequestMapping("/api/v1/correos")
@Tag(name = "Correos", description = "Previsualización y envío de prueba de los correos automáticos del sistema")
@PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
public class VistaPreviaCorreoController {

    private static final Pattern PATRON_EMAIL = Pattern.compile("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");

    private final MarcaCorreoService marcaService;
    private final EmailService emailService;

    public VistaPreviaCorreoController(MarcaCorreoService marcaService, EmailService emailService) {
        this.marcaService = marcaService;
        this.emailService = emailService;
    }

    /**
     * @param id      identificador para pedir la vista previa
     * @param cuando  en qué momento lo manda el sistema
     */
    public record TipoCorreoResponse(String id, String etiqueta, String cuando) {}

    @GetMapping("/tipos")
    @Operation(summary = "Listar los correos automáticos que el sistema puede enviar")
    public List<TipoCorreoResponse> tipos() {
        return Arrays.stream(CorreosDelSistema.Tipo.values())
                .map(t -> new TipoCorreoResponse(t.name(), t.getEtiqueta(), t.getCuando()))
                .toList();
    }

    /**
     * Devuelve el correo montado con datos de ejemplo.
     *
     * <p>Se sirve como {@code text/html} para poder pintarlo dentro de un
     * iframe: es la única forma de verlo con sus estilos, porque el correo va
     * maquetado con tablas y estilos en línea que se romperían al incrustarlo
     * en la página.
     *
     * @param programaId marca de ese programa; sin él se usa la institucional
     */
    @GetMapping(value = "/vista-previa/{tipo}", produces = MediaType.TEXT_HTML_VALUE + ";charset=UTF-8")
    @Operation(summary = "Ver cómo queda un correo sin enviarlo")
    public String vistaPrevia(@PathVariable String tipo,
                              @RequestParam(required = false) UUID programaId) {
        CorreosDelSistema.Tipo elegido;
        try {
            elegido = CorreosDelSistema.Tipo.valueOf(tipo.toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Tipo de correo no reconocido: " + tipo);
        }
        return CorreosDelSistema.ejemplo(elegido, marcaService.para(programaId), marcaService.frontendUrl());
    }

    /**
     * Envía un correo de prueba del sistema en vivo a un destinatario específico.
     */
    @PostMapping("/enviar-prueba")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @Operation(summary = "Enviar un correo de prueba del sistema en vivo")
    public PlantillaDtos.ResultadoEnvioResponse enviarPrueba(@RequestBody PlantillaDtos.EnviarPruebaSistemaRequest request) {
        if (request == null || request.tipo() == null) {
            throw new BusinessException("Debe especificar un tipo de correo del sistema.");
        }
        String destino = request.emailDestino();
        if (destino.isBlank() || !PATRON_EMAIL.matcher(destino).matches()) {
            throw new BusinessException("Dirección de correo electrónico inválida: " + request.destinatario());
        }

        String html = CorreosDelSistema.ejemplo(
                request.tipo(),
                marcaService.para(request.programaId()),
                marcaService.frontendUrl());
        String asunto = "[Prueba] " + request.tipo().getEtiqueta() + " — NOVA CRM";

        var resultado = emailService.enviar(destino, asunto, html);

        int enviados = resultado.enviado() ? 1 : 0;
        int bloqueadosPorLista = 0;
        int fallidos = 0;
        if (!resultado.enviado()) {
            if (resultado.motivoFallo() != null && resultado.motivoFallo().contains("lista de pruebas")) {
                bloqueadosPorLista = 1;
            } else {
                fallidos = 1;
            }
        }

        return new PlantillaDtos.ResultadoEnvioResponse(
                enviados,
                bloqueadosPorLista,
                fallidos,
                emailService.canalActivo());
    }
}
