package com.novacrm.empresa.portal;

import com.novacrm.vacante.MotivoCierre;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Vacantes desde el lado de la empresa.
 *
 * <p>Ni un solo endpoint recibe el identificador de la empresa: se toma
 * siempre de la sesion con {@link AccesoDelPortal#empresaDe}. Aceptarlo por
 * parametro seria dejar que una empresa pida las vacantes de otra cambiando un
 * numero en la URL, y ninguna comprobacion de rol lo detendria porque el rol
 * seria el correcto.
 */
@RestController
@RequestMapping("/api/v1/portal/vacantes")
@Tag(name = "Portal de empresas", description = "Publicacion de vacantes por la propia empresa")
@PreAuthorize("hasRole('EMPRESA')")
public class PortalVacanteController {

    private final PortalVacanteService servicio;
    private final AccesoDelPortal acceso;

    public PortalVacanteController(PortalVacanteService servicio, AccesoDelPortal acceso) {
        this.servicio = servicio;
        this.acceso = acceso;
    }

    /** Los campos de moderacion no estan aqui a proposito: no los pone la empresa. */
    public record VacanteEntrante(
            @NotBlank(message = "Falta el titulo del puesto")
            @Size(max = 255) String titulo,
            @Size(max = 20000) String descripcion,
            @Size(max = 10000) String requisitos,
            @Size(max = 255) String ciudad,
            @Size(max = 60) String modalidadTrabajo,
            @Size(max = 60) String tipoContrato,
            @Size(max = 40) String jornada,
            @Size(max = 120) String rangoSalarial,
            @Size(max = 60) String nivelInglesRequerido,
            Integer aniosExperienciaRequeridos,
            LocalDateTime fechaExpiracion) {

        PortalVacanteService.DatosDeVacante aDatos() {
            return new PortalVacanteService.DatosDeVacante(
                    titulo, descripcion, requisitos, ciudad, modalidadTrabajo,
                    tipoContrato, jornada, rangoSalarial, nivelInglesRequerido,
                    aniosExperienciaRequeridos, fechaExpiracion);
        }
    }

    @GetMapping
    @Operation(summary = "Las vacantes de mi empresa, con sus borradores")
    public List<PortalVacanteService.VacanteDelPortal> mias(Authentication auth) {
        return servicio.mias(acceso.empresaDe(auth));
    }

    @PostMapping
    @Operation(summary = "Crear una vacante; entra a revision salvo que se guarde como borrador")
    public PortalVacanteService.VacanteDelPortal crear(
            @Valid @RequestBody VacanteEntrante datos,
            @RequestParam(defaultValue = "false") boolean borrador,
            Authentication auth) {
        return servicio.crear(acceso.empresaDe(auth), datos.aDatos(), borrador, auth.getName());
    }

    @PutMapping("/{id}")
    @Operation(summary = "Editar una vacante propia; si estaba publicada vuelve a revision")
    public PortalVacanteService.VacanteDelPortal editar(
            @PathVariable UUID id,
            @Valid @RequestBody VacanteEntrante datos,
            @RequestParam(defaultValue = "true") boolean enviar,
            Authentication auth) {
        return servicio.editar(id, acceso.empresaDe(auth), datos.aDatos(), enviar);
    }

    @PostMapping("/{id}/enviar")
    @Operation(summary = "Enviar un borrador a la revision del equipo")
    public PortalVacanteService.VacanteDelPortal enviar(@PathVariable UUID id, Authentication auth) {
        return servicio.enviarARevision(id, acceso.empresaDe(auth));
    }

    @PostMapping("/{id}/cerrar")
    @Operation(summary = "Cerrar una vacante propia")
    public PortalVacanteService.VacanteDelPortal cerrar(
            @PathVariable UUID id,
            @RequestParam(required = false) MotivoCierre motivo,
            Authentication auth) {
        return servicio.cerrar(id, acceso.empresaDe(auth), motivo);
    }
}
