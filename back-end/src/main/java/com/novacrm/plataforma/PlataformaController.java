package com.novacrm.plataforma;

import com.novacrm.plataforma.dto.PlataformaAsignacionRequest;
import com.novacrm.plataforma.dto.PlataformaRequest;
import com.novacrm.plataforma.dto.PlataformaResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/plataformas")
@Tag(name = "Plataformas", description = "Plataformas externas y su asignación a programas y estudiantes")
public class PlataformaController {

    private final PlataformaService plataformaService;
    private final com.novacrm.auth.OwnershipService ownershipService;

    public PlataformaController(PlataformaService plataformaService,
                                com.novacrm.auth.OwnershipService ownershipService) {
        this.plataformaService = plataformaService;
        this.ownershipService = ownershipService;
    }

    // ── Catálogo (Configuración) ────────────────────────────────────────────

    @GetMapping
    @Operation(summary = "Catálogo de plataformas activas")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<PlataformaResponse> catalogo() {
        return plataformaService.catalogo();
    }

    @PostMapping
    @Operation(summary = "Crear plataforma")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public PlataformaResponse crear(@Valid @RequestBody PlataformaRequest request) {
        return plataformaService.crear(request);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar plataforma (nombre, enlace, imagen)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public PlataformaResponse actualizar(@PathVariable UUID id, @Valid @RequestBody PlataformaRequest request) {
        return plataformaService.actualizar(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Desactivar plataforma (borrado suave)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable UUID id) {
        plataformaService.eliminar(id);
    }

    // ── Asignación por programa ─────────────────────────────────────────────

    @GetMapping("/programa/{programaId}")
    @Operation(summary = "Plataformas visibles en un programa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<PlataformaResponse> plataformasDePrograma(@PathVariable UUID programaId) {
        return plataformaService.plataformasDePrograma(programaId);
    }

    @PutMapping("/programa/{programaId}")
    @Operation(summary = "Asignar plataformas al programa (reemplazo total)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<PlataformaResponse> asignarPrograma(@PathVariable UUID programaId,
                                                    @RequestBody PlataformaAsignacionRequest request) {
        plataformaService.asignarPrograma(programaId, request);
        return plataformaService.plataformasDePrograma(programaId);
    }

    // ── Asignación por estudiante ───────────────────────────────────────────

    @GetMapping("/estudiante/{estudianteId}")
    @Operation(summary = "Plataformas asignadas a un estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<PlataformaResponse> plataformasDeEstudiante(@PathVariable UUID estudianteId) {
        return plataformaService.plataformasDeEstudiante(estudianteId);
    }

    @PutMapping("/estudiante/{estudianteId}")
    @Operation(summary = "Asignar plataformas al estudiante (reemplazo total)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<PlataformaResponse> asignarEstudiante(@PathVariable UUID estudianteId,
                                                      @RequestBody PlataformaAsignacionRequest request) {
        plataformaService.asignarEstudiante(estudianteId, request);
        return plataformaService.plataformasDeEstudiante(estudianteId);
    }

    // ── Portal del estudiante ───────────────────────────────────────────────

    @GetMapping("/mias")
    @Operation(summary = "Plataformas activas asignadas al estudiante autenticado")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public List<PlataformaResponse> mias(Authentication auth) {
        return plataformaService.plataformasDeEstudiantePorEmail(auth.getName());
    }
}