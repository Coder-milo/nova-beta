package com.novacrm.actividad;

import com.novacrm.actividad.dto.ActividadRequest;
import com.novacrm.actividad.dto.ActividadResponse;
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
@RequestMapping("/api/v1")
@Tag(name = "Actividades", description = "Actividades de programas")
public class ActividadController {

    private final ActividadService actividadService;

    public ActividadController(ActividadService actividadService) {
        this.actividadService = actividadService;
    }

    @GetMapping("/programas/{programaId}/actividades")
    @Operation(summary = "Listar actividades de un programa")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR', 'ESTUDIANTE')")
    public List<ActividadResponse> listar(@PathVariable UUID programaId) {
        return actividadService.listar(programaId);
    }

    @GetMapping("/actividades/proximas")
    @Operation(summary = "Próximas 10 actividades desde hoy en todos los programas")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR', 'ESTUDIANTE')")
    public List<ActividadResponse> proximas() {
        return actividadService.proximas();
    }

    @GetMapping("/actividades")
    @Operation(summary = "Listar agenda completa")
    @PreAuthorize("hasAnyRole('ADMIN', 'COORDINADOR', 'ESTUDIANTE')")
    public List<ActividadResponse> agenda() {
        return actividadService.listarAgenda();
    }

    @GetMapping("/actividades/mias")
    @Operation(summary = "Agenda visible para el estudiante autenticado")
    @PreAuthorize("hasRole('ESTUDIANTE')")
    public List<ActividadResponse> mias(Authentication auth) {
        return actividadService.mias(auth);
    }

    @PostMapping("/actividades")
    @Operation(summary = "Crear actividad o nota en la agenda general")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ActividadResponse crearAgenda(@Valid @RequestBody ActividadRequest request) {
        return actividadService.crear(request);
    }

    @PutMapping("/actividades/{id}")
    @Operation(summary = "Actualizar actividad de la agenda")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ActividadResponse actualizarAgenda(@PathVariable UUID id,
                                              @Valid @RequestBody ActividadRequest request) {
        return actividadService.actualizar(id, request);
    }

    @PatchMapping("/actividades/{id}/completada")
    @Operation(summary = "Marcar o desmarcar una actividad como completada")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ActividadResponse completar(@PathVariable UUID id) {
        return actividadService.alternarCompletada(id);
    }

    @DeleteMapping("/actividades/{id}")
    @Operation(summary = "Eliminar actividad de la agenda")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminarAgenda(@PathVariable UUID id) {
        actividadService.eliminar(id);
    }

    @PostMapping("/programas/{programaId}/actividades")
    @Operation(summary = "Crear actividad")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ActividadResponse crear(@PathVariable UUID programaId,
                                   @Valid @RequestBody ActividadRequest request) {
        return actividadService.crear(programaId, request);
    }

    @PutMapping("/programas/{programaId}/actividades/{id}")
    @Operation(summary = "Actualizar actividad")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ActividadResponse actualizar(@PathVariable UUID programaId,
                                        @PathVariable UUID id,
                                        @Valid @RequestBody ActividadRequest request) {
        return actividadService.actualizar(programaId, id, request);
    }

    @DeleteMapping("/programas/{programaId}/actividades/{id}")
    @Operation(summary = "Eliminar actividad")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable UUID programaId, @PathVariable UUID id) {
        actividadService.eliminar(programaId, id);
    }
}
