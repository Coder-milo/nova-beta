package com.novacrm.configuracion;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Configuracion de la instalacion: identidad de la institucion y parametros de
 * operacion.
 *
 * <p>Convive con {@code /api/v1/configuracion/integraciones}, que es otra cosa
 * —solo lectura, y nunca devuelve credenciales—. La lectura aqui la puede hacer
 * cualquiera con sesion porque son datos de la propia institucion; la escritura
 * es de ADMIN o COORDINADOR.
 */
@RestController
@RequestMapping("/api/v1/configuracion")
@Tag(name = "Configuracion", description = "Datos institucionales y parametros de operacion")
public class ConfiguracionController {

    private final ConfiguracionService configuracionService;

    public ConfiguracionController(ConfiguracionService configuracionService) {
        this.configuracionService = configuracionService;
    }

    /**
     * Leer la configuración es de gestión, igual que escribirla.
     *
     * <p>Estaba abierta a cualquier usuario autenticado sin que ninguna pantalla
     * del estudiante la usara: los tres sitios que la piden son la pantalla de
     * configuración y sus dos paneles, todos de administración. Mientras tanto
     * la respuesta lleva el NIT y el registro educativo de la institución, y los
     * dos parámetros con los que trabaja el sistema —el corte del matching y los
     * días que aguanta una ficha en la papelera—.
     *
     * <p>Es la misma fuga que ya se cerró en las actividades y, antes, en
     * programas y vacantes. Se apunta aquí porque es la tercera vez: cuando un
     * endpoint devuelve datos de dos audiencias distintas, el permiso acaba
     * puesto al de la audiencia más amplia.
     */
    @GetMapping
    @Operation(summary = "Configuración vigente. Si nadie ha guardado nada, los valores por defecto.")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ConfiguracionResponse obtener() {
        return configuracionService.obtener();
    }

    @PutMapping
    @Operation(summary = "Guardar la configuración de la instalación")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ConfiguracionResponse guardar(@RequestBody ConfiguracionRequest request) {
        return configuracionService.guardar(request);
    }
}
