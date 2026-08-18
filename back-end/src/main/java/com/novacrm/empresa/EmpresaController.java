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
    private final FusionDeEmpresas fusionDeEmpresas;

    public EmpresaController(EmpresaService empresaService,
                             FusionDeEmpresas fusionDeEmpresas) {
        this.empresaService = empresaService;
        this.fusionDeEmpresas = fusionDeEmpresas;
    }

    /**
     * Fichas activas que parecen la misma empresa.
     *
     * <p>Es una sugerencia y no una decision: dos fichas con nombres casi
     * iguales pueden ser dos empresas distintas del mismo grupo, y fusionar no
     * se puede deshacer.
     */
    @GetMapping("/posibles-duplicados")
    @Operation(summary = "Fichas activas que parecen la misma empresa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public java.util.List<FusionDeEmpresas.PosibleDuplicado> posiblesDuplicados() {
        return fusionDeEmpresas.posiblesDuplicados();
    }

    /** Que colgaria de esta ficha si se fusionara. Para enseñarlo antes. */
    @GetMapping("/{id}/registros")
    @Operation(summary = "Cuantos registros cuelgan de una ficha")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public FusionDeEmpresas.Resumen registrosDe(@PathVariable UUID id) {
        return fusionDeEmpresas.queSeMoveria(id);
    }

    /**
     * Une dos fichas de la misma empresa.
     *
     * <p>{@code id} es la que se queda; {@code origenId}, la que se absorbe y se
     * desactiva. No se borra nada y no se pisa ningun dato: la que se queda solo
     * se rellena donde estaba vacia.
     */
    @PostMapping("/{id}/fusionar/{origenId}")
    @Operation(summary = "Absorber otra ficha de empresa dentro de esta")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public FusionDeEmpresas.Resumen fusionar(@PathVariable UUID id,
                                             @PathVariable UUID origenId) {
        return fusionDeEmpresas.fusionar(id, origenId);
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
                                             @RequestBody Map<String, String> cuerpo,
                                             org.springframework.security.core.Authentication auth) {
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
                cuerpo.get("proximoPaso"), cuerpo.get("nota"),
                auth != null ? auth.getName() : "sistema");
    }

    /**
     * El historial de acercamientos a una empresa.
     *
     * <p>La tabla existia desde la migracion V9 y nadie la leia ni la escribia:
     * cada nota se concatenaba al campo de texto de la ficha, con lo que no se
     * sabia quien habia escrito cada linea.
     */
    @GetMapping("/{id}/contactos")
    @Operation(summary = "Historial de acercamientos a una empresa")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public java.util.List<com.novacrm.empresa.dto.ContactoEmpresaResponse> contactos(
            @PathVariable UUID id) {
        return empresaService.contactosDe(id);
    }
}
