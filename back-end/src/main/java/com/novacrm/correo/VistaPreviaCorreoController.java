package com.novacrm.correo;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * Ver los correos automáticos antes de que salgan.
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
@Tag(name = "Correos", description = "Previsualización de los correos automáticos del sistema")
@PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
public class VistaPreviaCorreoController {

    private final MarcaCorreoService marcaService;

    public VistaPreviaCorreoController(MarcaCorreoService marcaService) {
        this.marcaService = marcaService;
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
            throw new com.novacrm.exception.BusinessException("Tipo de correo no reconocido: " + tipo);
        }
        return CorreosDelSistema.ejemplo(elegido, marcaService.para(programaId), marcaService.frontendUrl());
    }
}
