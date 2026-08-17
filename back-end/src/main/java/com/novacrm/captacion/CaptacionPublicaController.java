package com.novacrm.captacion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * La única puerta del sistema que se puede empujar sin identificarse.
 *
 * <p>Vive bajo {@code /api/v1/publico} y no bajo {@code /api/v1/vacantes} para
 * que la regla de seguridad se pueda leer de un vistazo: todo lo que cuelga de
 * ese prefijo es público, y nada público cuelga de otro sitio. Mezclarlo con
 * las rutas de vacantes obligaría a que el {@code permitAll} apuntara a un
 * método concreto, y el siguiente método que se añadiera al lado heredaría la
 * exposición sin que nadie lo decidiera.
 *
 * <p>Aquí solo se escribe. No hay ningún GET: un formulario de captación no
 * necesita leer nada, y cualquier lectura pública sería una forma de mirar
 * dentro sin cuenta.
 */
@RestController
@RequestMapping("/api/v1/publico")
@Tag(name = "Captacion publica",
     description = "Formulario abierto para que una empresa sin cuenta proponga una oferta")
public class CaptacionPublicaController {

    private final CaptacionPublicaService captacionPublicaService;

    public CaptacionPublicaController(CaptacionPublicaService captacionPublicaService) {
        this.captacionPublicaService = captacionPublicaService;
    }

    /**
     * La respuesta.
     *
     * <p>Siempre la misma frase, sin identificador ni nada que se pueda
     * relacionar con lo guardado: la respuesta a una petición anónima no debe
     * servir para averiguar el estado del sistema.
     */
    public record Recibido(String mensaje) {}

    @PostMapping("/vacantes")
    @Operation(summary = "Proponer una oferta sin tener cuenta; entra a revision")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Recibido proponerVacante(@Valid @RequestBody SolicitudPublicaDeVacante solicitud) {
        captacionPublicaService.recibir(solicitud);
        // 202 y no 201: no se ha creado nada que quien envía pueda ver ni
        // consultar. Se ha aceptado para revisión, que es otra cosa.
        return new Recibido(
                "Recibimos tu oferta. El equipo la revisa y te contacta al correo que dejaste.");
    }
}
