package com.novacrm.perfil;

import com.novacrm.auth.OwnershipService;
import com.novacrm.perfil.dto.ExperienciaRequest;
import com.novacrm.perfil.dto.ExperienciaResponse;
import com.novacrm.perfil.dto.FormacionRequest;
import com.novacrm.perfil.dto.FormacionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Formación adicional y experiencia laboral de un estudiante.
 *
 * <p>El estudiante mantiene su propia hoja de vida: es quien sabe en qué mes
 * empezó cada trabajo y qué hacía en él, y esperar a que un coordinador lo
 * transcribiera dejaba las HV generadas sin sección de experiencia. Antes solo
 * podían escribir aquí coordinación y administración.
 *
 * <p>Cada endpoint pasa por {@link OwnershipService}, que deja pasar a
 * coordinación y administración y limita al estudiante a su propia ficha. La
 * comprobación cubre también las lecturas, que no llevaban ninguna: cualquier
 * usuario autenticado podía pedir el historial laboral de otro sabiendo su id.
 */
@RestController
@RequestMapping("/api/v1/estudiantes/{estudianteId}")
@Tag(name = "Perfil", description = "Formación adicional y experiencia laboral del estudiante")
@PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
public class PerfilController {

    private final PerfilService perfilService;
    private final OwnershipService ownershipService;

    public PerfilController(PerfilService perfilService, OwnershipService ownershipService) {
        this.perfilService = perfilService;
        this.ownershipService = ownershipService;
    }

    // ── Formaciones ──────────────────────────────────────────────────────

    @GetMapping("/formaciones")
    @Operation(summary = "Listar formaciones adicionales de un estudiante")
    public List<FormacionResponse> listarFormaciones(@PathVariable UUID estudianteId, Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        return perfilService.listarFormaciones(estudianteId);
    }

    @PostMapping("/formaciones")
    @Operation(summary = "Crear formación adicional")
    @ResponseStatus(HttpStatus.CREATED)
    public FormacionResponse crearFormacion(@PathVariable UUID estudianteId,
                                            @Valid @RequestBody FormacionRequest request,
                                            Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        return perfilService.crearFormacion(estudianteId, request);
    }

    @PutMapping("/formaciones/{id}")
    @Operation(summary = "Actualizar formación adicional")
    public FormacionResponse actualizarFormacion(@PathVariable UUID estudianteId,
                                                 @PathVariable UUID id,
                                                 @Valid @RequestBody FormacionRequest request,
                                                 Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        return perfilService.actualizarFormacion(estudianteId, id, request);
    }

    @DeleteMapping("/formaciones/{id}")
    @Operation(summary = "Eliminar formación adicional")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminarFormacion(@PathVariable UUID estudianteId, @PathVariable UUID id, Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        perfilService.eliminarFormacion(estudianteId, id);
    }

    // ── Experiencias ─────────────────────────────────────────────────────

    @GetMapping("/experiencias")
    @Operation(summary = "Listar experiencias laborales de un estudiante")
    public List<ExperienciaResponse> listarExperiencias(@PathVariable UUID estudianteId, Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        return perfilService.listarExperiencias(estudianteId);
    }

    @PostMapping("/experiencias")
    @Operation(summary = "Crear experiencia laboral")
    @ResponseStatus(HttpStatus.CREATED)
    public ExperienciaResponse crearExperiencia(@PathVariable UUID estudianteId,
                                                @Valid @RequestBody ExperienciaRequest request,
                                                Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        return perfilService.crearExperiencia(estudianteId, request);
    }

    @PutMapping("/experiencias/{id}")
    @Operation(summary = "Actualizar experiencia laboral")
    public ExperienciaResponse actualizarExperiencia(@PathVariable UUID estudianteId,
                                                     @PathVariable UUID id,
                                                     @Valid @RequestBody ExperienciaRequest request,
                                                     Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        return perfilService.actualizarExperiencia(estudianteId, id, request);
    }

    @DeleteMapping("/experiencias/{id}")
    @Operation(summary = "Eliminar experiencia laboral")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminarExperiencia(@PathVariable UUID estudianteId, @PathVariable UUID id, Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        perfilService.eliminarExperiencia(estudianteId, id);
    }
}
