package com.novacrm.seguimiento;

import com.novacrm.seguimiento.dto.SeguimientoRequest;
import com.novacrm.seguimiento.dto.SeguimientoResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/estudiantes/{estudianteId}/seguimientos")
@Tag(name = "Seguimientos", description = "Seguimientos de estudiantes")
public class SeguimientoController {

    private final SeguimientoService seguimientoService;

    public SeguimientoController(SeguimientoService seguimientoService) {
        this.seguimientoService = seguimientoService;
    }

    @GetMapping
    @Operation(summary = "Listar seguimientos de un estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<SeguimientoResponse> listar(@PathVariable UUID estudianteId) {
        return seguimientoService.listar(estudianteId);
    }

    @PostMapping
    @Operation(summary = "Crear seguimiento")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public SeguimientoResponse crear(@PathVariable UUID estudianteId,
                                     @Valid @RequestBody SeguimientoRequest request) {
        return seguimientoService.crear(estudianteId, request);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar seguimiento")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public SeguimientoResponse actualizar(@PathVariable UUID estudianteId,
                                          @PathVariable UUID id,
                                          @Valid @RequestBody SeguimientoRequest request) {
        return seguimientoService.actualizar(estudianteId, id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar seguimiento")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable UUID estudianteId, @PathVariable UUID id) {
        seguimientoService.eliminar(estudianteId, id);
    }
}
