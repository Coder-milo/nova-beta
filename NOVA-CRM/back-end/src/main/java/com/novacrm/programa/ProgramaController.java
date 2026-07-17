package com.novacrm.programa;

import com.novacrm.programa.dto.ProgramaRequest;
import com.novacrm.programa.dto.ProgramaResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/programas")
@Tag(name = "Programas", description = "Gestión de programas de empleabilidad")
public class ProgramaController {

    private final ProgramaService programaService;

    public ProgramaController(ProgramaService programaService) {
        this.programaService = programaService;
    }

    @GetMapping
    @Operation(summary = "Listar programas activos")
    public List<ProgramaResponse> listar() {
        return programaService.listarActivos();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener programa por ID")
    public ProgramaResponse obtener(@PathVariable UUID id) {
        return programaService.obtener(id);
    }

    @PostMapping
    @Operation(summary = "Crear programa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public ProgramaResponse crear(@Valid @RequestBody ProgramaRequest request) {
        return programaService.crear(request);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar programa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ProgramaResponse actualizar(@PathVariable UUID id, @Valid @RequestBody ProgramaRequest request) {
        return programaService.actualizar(id, request);
    }

    @PatchMapping("/{id}/estado")
    @Operation(summary = "Cambiar estado del programa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ProgramaResponse cambiarEstado(@PathVariable UUID id, @RequestBody CambioEstadoRequest request) {
        return programaService.cambiarEstado(id, request.estado());
    }

    public record CambioEstadoRequest(ProgramaEstado estado) {}
}
