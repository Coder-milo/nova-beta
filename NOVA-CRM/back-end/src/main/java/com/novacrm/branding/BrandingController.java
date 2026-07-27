package com.novacrm.branding;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Identidad visual por programa.
 *
 * <p>La lectura la puede hacer cualquiera que haya iniciado sesion —la
 * interfaz necesita los colores para pintarse—, pero {@code BrandingService}
 * comprueba antes que el programa sea el suyo. La escritura es de ADMIN o
 * COORDINADOR.
 */
@RestController
@RequestMapping("/api/v1/branding")
@Tag(name = "Branding", description = "Identidad visual y plantilla de correo de cada programa")
public class BrandingController {

    private final BrandingService brandingService;

    public BrandingController(BrandingService brandingService) {
        this.brandingService = brandingService;
    }

    /**
     * La identidad del programa del propio usuario.
     *
     * <p>Existe para que un estudiante no tenga que conocer —ni mandar— el id
     * de su programa: pedirselo le obligaria a manejar un identificador de otro
     * y a que el servidor comprobase que no lo cambio por el de otro cliente.
     */
    @GetMapping("/mio")
    @Operation(summary = "Identidad visual del programa del usuario autenticado")
    @PreAuthorize("isAuthenticated()")
    public BrandingResponse mio(Authentication auth) {
        return brandingService.consultarElMio(auth);
    }

    @GetMapping("/{programaId}")
    @Operation(summary = "Identidad visual de un programa")
    @PreAuthorize("isAuthenticated()")
    public BrandingResponse consultar(Authentication auth, @PathVariable UUID programaId) {
        return brandingService.consultar(auth, programaId);
    }

    @PutMapping("/{programaId}")
    @Operation(summary = "Guardar la identidad visual de un programa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public BrandingResponse guardar(@PathVariable UUID programaId,
                                    @RequestBody BrandingRequest request) {
        return brandingService.guardar(programaId, request);
    }

    @DeleteMapping("/{programaId}")
    @Operation(summary = "Volver a la gama global del panel")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ResponseEntity<Void> restablecer(@PathVariable UUID programaId) {
        brandingService.restablecer(programaId);
        return ResponseEntity.noContent().build();
    }
}
