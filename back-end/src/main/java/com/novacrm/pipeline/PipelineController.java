package com.novacrm.pipeline;

import com.novacrm.auth.OwnershipService;
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
@RequestMapping("/api/v1/pipeline")
@Tag(name = "Pipeline de empleabilidad",
     description = "Estado de empleabilidad deducido de los hechos registrados en el sistema")
public class PipelineController {

    private final PipelineEmpleabilidadService pipelineService;
    private final OwnershipService ownershipService;

    public PipelineController(PipelineEmpleabilidadService pipelineService,
                              OwnershipService ownershipService) {
        this.pipelineService = pipelineService;
        this.ownershipService = ownershipService;
    }

    @GetMapping("/estudiante/{id}")
    @Operation(summary = "Estado de empleabilidad de un estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public PipelineEmpleabilidad porEstudiante(@PathVariable UUID id, Authentication auth) {
        // Un estudiante solo puede consultar su propio pipeline.
        ownershipService.verificarAccesoEstudiante(auth, id);
        return pipelineService.calcular(id);
    }

    @GetMapping("/mi-pipeline")
    @Operation(summary = "Estado de empleabilidad del estudiante autenticado")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public PipelineEmpleabilidad miPipeline(Authentication auth) {
        var estudiante = ownershipService.obtenerEstudianteAutenticado(auth);
        return pipelineService.calcular(estudiante.getId());
    }
}
