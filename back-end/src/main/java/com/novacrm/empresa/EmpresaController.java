package com.novacrm.empresa;

import com.novacrm.empresa.dto.EmpresaDtos.EmpresaResponse;
import com.novacrm.empresa.dto.EmpresaDtos.GuardarEmpresa;
import com.novacrm.empresa.dto.EmpresaDtos.ResumenCrm;
import com.novacrm.exception.BusinessException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Directorio de empresas y seguimiento de la relacion.
 *
 * <p>Todo el modulo es del equipo. Un estudiante no ve el directorio: a que
 * empresas se les esta escribiendo y en que punto va cada conversacion es
 * informacion del programa, no suya, y filtrarla por participante no tendria
 * sentido porque las empresas no son de nadie en particular.
 */
@RestController
@RequestMapping("/api/v1/empresas")
@Tag(name = "Empresas", description = "Directorio de empleadores y estado de la relacion")
public class EmpresaController {

    private final EmpresaService empresaService;

    public EmpresaController(EmpresaService empresaService) {
        this.empresaService = empresaService;
    }

    @GetMapping
    @Operation(summary = "Buscar empresas por nombre, sector o cargos que suele abrir")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Page<EmpresaResponse> buscar(
            @RequestParam(required = false) String texto,
            @RequestParam(required = false) String sector,
            @RequestParam(required = false) EstadoRelacion estado,
            @PageableDefault(size = 25, sort = "nombre", direction = Sort.Direction.ASC) Pageable pageable) {
        return empresaService.buscar(texto, sector, estado, pageable);
    }

    @GetMapping("/resumen")
    @Operation(summary = "Cuantas empresas hay en cada estado de relacion")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ResumenCrm resumen() {
        return empresaService.resumen();
    }

    @GetMapping("/sectores")
    @Operation(summary = "Sectores presentes en el directorio")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<String> sectores() {
        return empresaService.sectores();
    }

    @GetMapping("/estados-relacion")
    @Operation(summary = "Estados posibles de la relacion con una empresa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<Map<String, Object>> estadosRelacion() {
        return java.util.Arrays.stream(EstadoRelacion.values())
                .map(e -> Map.<String, Object>of(
                        "valor", e.name(),
                        "etiqueta", e.getEtiqueta(),
                        "viva", e.estaViva()))
                .toList();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Ficha de una empresa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public EmpresaResponse obtener(@PathVariable UUID id) {
        return empresaService.obtener(id);
    }

    @PostMapping
    @Operation(summary = "Dar de alta una empresa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public EmpresaResponse crear(@Valid @RequestBody GuardarEmpresa datos) {
        return empresaService.crear(datos);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar una empresa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public EmpresaResponse actualizar(@PathVariable UUID id, @Valid @RequestBody GuardarEmpresa datos) {
        return empresaService.actualizar(id, datos);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar una empresa")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public void eliminar(@PathVariable UUID id) {
        empresaService.eliminar(id);
    }

    @PostMapping("/{id}/contacto")
    @Operation(summary = "Registrar un acercamiento y mover el estado de la relacion")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public EmpresaResponse registrarContacto(@PathVariable UUID id,
                                             @RequestBody Map<String, String> cuerpo) {
        EstadoRelacion estado = null;
        String valor = cuerpo.get("estado");
        if (valor != null && !valor.isBlank()) {
            try {
                estado = EstadoRelacion.valueOf(valor.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new BusinessException("Estado de relacion invalido: " + valor);
            }
        }
        return empresaService.registrarContacto(id, estado,
                cuerpo.get("proximoPaso"), cuerpo.get("nota"));
    }
}
