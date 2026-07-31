package com.novacrm.programa;

import com.novacrm.programa.dto.ProgramaRequest;
import com.novacrm.programa.dto.ProgramaResponse;
import com.novacrm.programa.dto.ProgramaResumenResponse;
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
    @Operation(summary = "Listar programas activos (con filtros opcionales)")
    // Solo el equipo: el listado lleva cliente, responsable y metricas de
    // todas las cohortes. El estudiante ve su programa por su propia ficha.
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<ProgramaResponse> listar(@RequestParam(required = false) String q,
                                         @RequestParam(required = false) ProgramaEstado estado,
                                         @RequestParam(required = false) String cliente,
                                         @RequestParam(required = false) String responsable) {
        if (q == null && estado == null && cliente == null && responsable == null) {
            return programaService.listarActivos();
        }
        return programaService.buscar(q, estado, cliente, responsable);
    }

    @GetMapping("/{id}/resumen")
    @Operation(summary = "Indicadores del proyecto (detalle)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ProgramaResumenResponse resumen(@PathVariable UUID id) {
        return programaService.resumen(id);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener programa por ID")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
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
        if (request == null || request.estado() == null) {
            throw new com.novacrm.exception.BusinessException("Indica el estado del programa");
        }
        return programaService.cambiarEstado(id, request.estado());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar programa (soft delete)")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable UUID id) {
        programaService.eliminar(id);
    }

    public record CambioEstadoRequest(ProgramaEstado estado) {}
}
