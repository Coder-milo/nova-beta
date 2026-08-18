package com.novacrm.certificacion;

import com.novacrm.auth.OwnershipService;
import com.novacrm.certificacion.dto.CertificacionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/certificaciones")
@Tag(name = "Certificaciones", description = "Certificaciones digitales")
public class CertificacionController {

    private final CertificacionService certificacionService;
    private final OwnershipService ownershipService;

    public CertificacionController(CertificacionService certificacionService,
                                   OwnershipService ownershipService) {
        this.certificacionService = certificacionService;
        this.ownershipService = ownershipService;
    }

    /**
     * El estudiante solo puede pedir las de su propio programa.
     *
     * <p>El identificador del programa llega por parametro, asi que sin esta
     * comprobacion bastaba con cambiarlo para leer el catalogo de formacion de
     * otro cliente, con el nombre de su programa incluido. Quien gestiona no
     * tiene esa restriccion, que es lo que resuelve
     * {@link OwnershipService#verificarAccesoPrograma}.
     */
    @GetMapping
    @Operation(summary = "Listar certificaciones por programa")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR', 'ESTUDIANTE')")
    public List<CertificacionResponse> listar(@RequestParam UUID programaId, Authentication auth) {
        ownershipService.verificarAccesoPrograma(auth, programaId);
        return certificacionService.listarPorPrograma(programaId);
    }

    /**
     * Se lee la certificacion y despues se comprueba de que programa es.
     *
     * <p>No se puede comprobar antes porque el programa no viaja en la peticion;
     * el orden importa poco de todos modos, ya que la respuesta no se construye
     * si la comprobacion falla.
     */
    @GetMapping("/{id}")
    @Operation(summary = "Obtener certificacion por ID")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR', 'ESTUDIANTE')")
    public CertificacionResponse obtener(@PathVariable UUID id, Authentication auth) {
        var certificacion = certificacionService.obtener(id);
        if (certificacion.programaId() != null) {
            ownershipService.verificarAccesoPrograma(auth, certificacion.programaId());
        }
        return certificacion;
    }
}
