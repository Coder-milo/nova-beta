package com.novacrm.estudiante;

import com.novacrm.estudiante.dto.EstudianteRequest;
import com.novacrm.estudiante.dto.EstudianteResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/estudiantes")
@Tag(name = "Estudiantes", description = "Gestión de estudiantes")
public class EstudianteController {

    private final EstudianteService estudianteService;
    private final com.novacrm.auth.OwnershipService ownershipService;

    public EstudianteController(EstudianteService estudianteService,
                                com.novacrm.auth.OwnershipService ownershipService) {
        this.estudianteService = estudianteService;
        this.ownershipService = ownershipService;
    }

    @GetMapping
    @Operation(summary = "Listar estudiantes por programa (paginado)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Page<EstudianteResponse> listar(
            @RequestParam UUID programaId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return estudianteService.listarPorPrograma(programaId, pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener estudiante por ID")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public EstudianteResponse obtener(@PathVariable UUID id) {
        return estudianteService.obtener(id);
    }

    @PostMapping
    @Operation(summary = "Crear estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public EstudianteResponse crear(@Valid @RequestBody EstudianteRequest request) {
        return estudianteService.crear(request);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN', 'ESTUDIANTE')")
    public EstudianteResponse actualizar(@PathVariable UUID id, @Valid @RequestBody EstudianteRequest request,
                                          Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, id);
        return estudianteService.actualizar(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar (soft delete) estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable UUID id) {
        estudianteService.softDelete(id);
    }
}
