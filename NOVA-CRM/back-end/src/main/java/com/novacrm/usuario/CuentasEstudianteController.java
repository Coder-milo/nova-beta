package com.novacrm.usuario;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Alta masiva de cuentas de acceso para los estudiantes.
 *
 * <p>Va bajo {@code /api/v1/admin} para que quede cubierto tambien por la
 * regla de URL de {@code SecurityConfig}, ademas del {@code @PreAuthorize}.
 */
@RestController
@RequestMapping("/api/v1/admin/cuentas-estudiante")
@Tag(name = "Cuentas de estudiante",
     description = "Creacion masiva de usuarios y envio de credenciales")
public class CuentasEstudianteController {

    private final CuentasEstudianteService cuentasService;

    public CuentasEstudianteController(CuentasEstudianteService cuentasService) {
        this.cuentasService = cuentasService;
    }

    /**
     * @param estudianteIds ids concretos; vacio = todos los estudiantes activos
     * @param enviarCorreo  enviar a cada estudiante su acceso
     * @param simulacion    no crea nada; informa que haria
     */
    public record AltaMasivaRequest(
            List<UUID> estudianteIds,
            Boolean enviarCorreo,
            Boolean simulacion) {}

    @PostMapping
    @Operation(summary = "Crear cuentas de acceso para estudiantes y enviarles sus credenciales")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public CuentasEstudianteService.ResumenAlta crear(@RequestBody(required = false) AltaMasivaRequest request) {
        var peticion = request == null
                ? new AltaMasivaRequest(null, null, null)
                : request;

        return cuentasService.crearCuentas(
                peticion.estudianteIds(),
                Boolean.TRUE.equals(peticion.enviarCorreo()),
                // Por defecto simula: crear 107 cuentas no debe ser el efecto
                // de una llamada hecha por descuido.
                peticion.simulacion() == null || peticion.simulacion());
    }

    /**
     * Quien tiene cuenta y quien no, para poder elegir a quien escribirle.
     *
     * <p>Es un GET y no una simulacion del POST anterior a proposito: abrir la
     * pantalla no debe mandar una peticion a la URL que crea cuentas. Un
     * reintento del navegador o un doble envio sobre ese endpoint es
     * exactamente el accidente que no queremos con 107 personas detras.
     */
    @GetMapping
    @Operation(summary = "Listar los estudiantes indicando cuales ya tienen cuenta")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public CuentasEstudianteService.Padron listar() {
        return cuentasService.padron();
    }

    @GetMapping(value = "/vista-previa-correo", produces = "text/html;charset=UTF-8")
    @Operation(summary = "Ver como queda el correo de activacion sin enviarlo")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public String vistaPreviaCorreo() {
        return cuentasService.correoDeActivacion(
                "Nombre Del Estudiante", "estudiante@ejemplo.com", "token-de-ejemplo");
    }
}
