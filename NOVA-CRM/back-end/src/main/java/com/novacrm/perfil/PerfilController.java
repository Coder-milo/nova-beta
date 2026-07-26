package com.novacrm.perfil;

import com.novacrm.perfil.dto.ExperienciaRequest;
import com.novacrm.perfil.dto.ExperienciaResponse;
import com.novacrm.perfil.dto.FormacionRequest;
import com.novacrm.perfil.dto.FormacionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/estudiantes/{estudianteId}")
@Tag(name = "Perfil", description = "Formación adicional y experiencia laboral del estudiante")
public class PerfilController {

    private final PerfilService perfilService;

    public PerfilController(PerfilService perfilService) {
        this.perfilService = perfilService;
    }

    // ── Formaciones ──────────────────────────────────────────────────────

    @GetMapping("/formaciones")
    @Operation(summary = "Listar formaciones adicionales de un estudiante")
    public List<FormacionResponse> listarFormaciones(@PathVariable UUID estudianteId) {
        return perfilService.listarFormaciones(estudianteId);
    }

    @PostMapping("/formaciones")
    @Operation(summary = "Crear formación adicional")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public FormacionResponse crearFormacion(@PathVariable UUID estudianteId,
                                            @Valid @RequestBody FormacionRequest request) {
        return perfilService.crearFormacion(estudianteId, request);
    }

    @PutMapping("/formaciones/{id}")
    @Operation(summary = "Actualizar formación adicional")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public FormacionResponse actualizarFormacion(@PathVariable UUID estudianteId,
                                                 @PathVariable UUID id,
                                                 @Valid @RequestBody FormacionRequest request) {
        return perfilService.actualizarFormacion(estudianteId, id, request);
    }

    @DeleteMapping("/formaciones/{id}")
    @Operation(summary = "Eliminar formación adicional")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminarFormacion(@PathVariable UUID estudianteId, @PathVariable UUID id) {
        perfilService.eliminarFormacion(estudianteId, id);
    }

    // ── Experiencias ─────────────────────────────────────────────────────

    @GetMapping("/experiencias")
    @Operation(summary = "Listar experiencias laborales de un estudiante")
    public List<ExperienciaResponse> listarExperiencias(@PathVariable UUID estudianteId) {
        return perfilService.listarExperiencias(estudianteId);
    }

    @PostMapping("/experiencias")
    @Operation(summary = "Crear experiencia laboral")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ExperienciaResponse crearExperiencia(@PathVariable UUID estudianteId,
                                                @Valid @RequestBody ExperienciaRequest request) {
        return perfilService.crearExperiencia(estudianteId, request);
    }

    @PutMapping("/experiencias/{id}")
    @Operation(summary = "Actualizar experiencia laboral")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ExperienciaResponse actualizarExperiencia(@PathVariable UUID estudianteId,
                                                     @PathVariable UUID id,
                                                     @Valid @RequestBody ExperienciaRequest request) {
        return perfilService.actualizarExperiencia(estudianteId, id, request);
    }

    @DeleteMapping("/experiencias/{id}")
    @Operation(summary = "Eliminar experiencia laboral")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminarExperiencia(@PathVariable UUID estudianteId, @PathVariable UUID id) {
        perfilService.eliminarExperiencia(estudianteId, id);
    }
}
