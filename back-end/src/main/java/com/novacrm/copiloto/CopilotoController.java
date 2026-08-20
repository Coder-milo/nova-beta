package com.novacrm.copiloto;

import com.novacrm.auth.OwnershipService;
import com.novacrm.copiloto.CopilotoDtos.Audiencia;
import com.novacrm.copiloto.CopilotoDtos.CentroAccion;
import com.novacrm.copiloto.CopilotoDtos.Respuesta;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/copiloto")
@Tag(name = "Copiloto de empleabilidad",
     description = "Recomendaciones explicables basadas exclusivamente en datos estructurados")
public class CopilotoController {

    private final CopilotoService copilotoService;
    private final OwnershipService ownershipService;

    public CopilotoController(CopilotoService copilotoService, OwnershipService ownershipService) {
        this.copilotoService = copilotoService;
        this.ownershipService = ownershipService;
    }

    @GetMapping("/estudiante/{id}")
    @Operation(summary = "Top 3 de acciones para una ficha, vista de gestión")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Respuesta estudiante(@PathVariable UUID id) {
        return copilotoService.recomendaciones(id, Audiencia.ADMINISTRACION);
    }

    @GetMapping("/mio")
    @Operation(summary = "Siguiente paso del estudiante autenticado")
    @PreAuthorize("hasRole('ESTUDIANTE')")
    public Respuesta mio(Authentication auth) {
        var estudiante = ownershipService.obtenerEstudianteAutenticado(auth);
        return copilotoService.recomendaciones(estudiante.getId(), Audiencia.ESTUDIANTE);
    }

    @GetMapping("/centro-accion")
    @Operation(summary = "Grupos de atención y ranking de intervención")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public CentroAccion centroAccion() {
        return copilotoService.centroAccion();
    }
}
