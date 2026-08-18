package com.novacrm.empresa.portal;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Alta y baja de cuentas del portal de empresas.
 *
 * <p>Vive del lado del programa, no del portal: es el equipo quien invita y
 * quien revoca. De ahi que exija COORDINADOR o ADMIN y que no haya ningun
 * endpoint publico de registro.
 */
@RestController
@RequestMapping("/api/v1/empresas/{empresaId}/cuentas")
@Tag(name = "Portal de empresas", description = "Cuentas de acceso para empresas aliadas")
public class CuentasEmpresaController {

    private final CuentasEmpresaService cuentasEmpresaService;

    public CuentasEmpresaController(CuentasEmpresaService cuentasEmpresaService) {
        this.cuentasEmpresaService = cuentasEmpresaService;
    }

    public record InvitarCuenta(
            @NotBlank(message = "Falta el correo")
            @Email(message = "El correo no es valido")
            @Size(max = 160) String email,

            @Size(max = 160) String nombre) {}

    @GetMapping
    @Operation(summary = "Cuentas del portal de esta empresa, incluidas las revocadas")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public java.util.List<CuentasEmpresaService.CuentaDelPortal> listar(@PathVariable UUID empresaId) {
        return cuentasEmpresaService.cuentasDe(empresaId);
    }

    @PostMapping
    @Operation(summary = "Invitar a una persona de contacto de la empresa al portal")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public CuentasEmpresaService.ResultadoInvitacion invitar(
            @PathVariable UUID empresaId,
            @Valid @RequestBody InvitarCuenta datos) {
        return cuentasEmpresaService.invitar(empresaId, datos.email(), datos.nombre());
    }

    @DeleteMapping("/{usuarioId}")
    @Operation(summary = "Revocar el acceso de una cuenta del portal")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Map<String, String> revocar(@PathVariable UUID empresaId,
                                       @PathVariable UUID usuarioId) {
        cuentasEmpresaService.revocar(usuarioId);
        return Map.of("mensaje", "Acceso revocado");
    }
}
