package com.novacrm.colocacion;

import com.novacrm.auth.OwnershipService;
import com.novacrm.colocacion.dto.ColocacionDtos.ColocacionResponse;
import com.novacrm.colocacion.dto.ColocacionDtos.GuardarColocacion;
import com.novacrm.colocacion.dto.ColocacionDtos.ResumenColocaciones;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Colocaciones laborales.
 *
 * <p>Las registra el equipo, no el participante: llevan salario, contrato y
 * checklist de ingreso, y son la cifra que se reporta. Un estudiante puede ver
 * la suya —es su empleo— pero no crearla ni editarla.
 */
@RestController
@RequestMapping("/api/v1/colocaciones")
@Tag(name = "Colocaciones", description = "Vinculacion laboral de los participantes")
public class ColocacionController {

    private final ColocacionService colocacionService;
    private final OwnershipService ownershipService;

    public ColocacionController(ColocacionService colocacionService,
                                OwnershipService ownershipService) {
        this.colocacionService = colocacionService;
        this.ownershipService = ownershipService;
    }

    @GetMapping
    @Operation(summary = "Colocaciones vigentes")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<ColocacionResponse> vigentes() {
        return colocacionService.vigentes();
    }

    @GetMapping("/resumen")
    @Operation(summary = "Cifras de colocacion: sobre meta, por canal, checklist")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ResumenColocaciones resumen() {
        return colocacionService.resumen();
    }

    @GetMapping("/mia")
    @Operation(summary = "Mi colocacion")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public List<ColocacionResponse> mia(Authentication auth) {
        var estudiante = ownershipService.obtenerEstudianteAutenticado(auth);
        return colocacionService.deEstudiante(estudiante.getId());
    }

    @GetMapping("/estudiante/{estudianteId}")
    @Operation(summary = "Colocaciones de un estudiante")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public List<ColocacionResponse> deEstudiante(@PathVariable UUID estudianteId, Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        return colocacionService.deEstudiante(estudianteId);
    }

    @PostMapping
    @Operation(summary = "Registrar una colocacion")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ColocacionResponse registrar(@Valid @RequestBody GuardarColocacion datos, Authentication auth) {
        return colocacionService.registrar(datos, auth.getName());
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar una colocacion")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public ColocacionResponse actualizar(@PathVariable UUID id,
                                         @Valid @RequestBody GuardarColocacion datos,
                                         Authentication auth) {
        return colocacionService.actualizar(id, datos, auth.getName());
    }

    @PostMapping("/{id}/cerrar")
    @Operation(summary = "Cerrar una colocacion sin borrarla")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Map<String, String> cerrar(@PathVariable UUID id,
                                      @RequestBody(required = false) Map<String, String> cuerpo,
                                      Authentication auth) {
        String motivo = cuerpo == null ? null : cuerpo.get("motivo");
        colocacionService.cerrar(id, motivo, auth.getName());
        return Map.of("mensaje", "Colocacion cerrada");
    }

    /** Catalogos para los desplegables del formulario. */
    @GetMapping("/catalogos")
    @Operation(summary = "Canales, tipos de vinculacion y meta salarial")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public Map<String, Object> catalogos() {
        return Map.of(
                "metaSalarial", colocacionService.getMetaSalarial(),
                "canales", java.util.Arrays.stream(CanalConsecucion.values())
                        .map(c -> Map.of(
                                "valor", c.name(),
                                "etiqueta", c.getEtiqueta(),
                                "gestionadaPorElPrograma", c.esGestionadaPorElPrograma()))
                        .toList(),
                "tiposVinculacion", java.util.Arrays.stream(TipoVinculacion.values())
                        .map(t -> Map.of(
                                "valor", t.name(),
                                "etiqueta", t.getEtiqueta(),
                                "esEmpleo", t.esEmpleo()))
                        .toList());
    }
}
