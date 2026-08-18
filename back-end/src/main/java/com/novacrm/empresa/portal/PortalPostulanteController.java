package com.novacrm.empresa.portal;

import com.novacrm.postulacion.EstadoPostulacion;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Postulantes, desde el lado de la empresa.
 *
 * <p>No hay ningun endpoint que reciba un identificador de estudiante. Se entra
 * siempre por la postulacion o por la vacante, que son las dos cosas que la
 * empresa posee. Un {@code GET /estudiantes/{id}} aunque fuera con permisos
 * seria una puerta al censo: bastaria con probar identificadores.
 */
@RestController
@RequestMapping("/api/v1/portal/postulantes")
@Tag(name = "Portal de empresas", description = "Candidatos a las vacantes de la empresa")
@PreAuthorize("hasRole('EMPRESA')")
public class PortalPostulanteController {

    private final PortalPostulanteService servicio;
    private final AccesoDelPortal acceso;

    public PortalPostulanteController(PortalPostulanteService servicio, AccesoDelPortal acceso) {
        this.servicio = servicio;
        this.acceso = acceso;
    }

    public record MoverPostulacion(
            @NotNull(message = "Falta el estado") EstadoPostulacion estado,
            @Size(max = 1000) String comentario) {}

    @GetMapping
    @Operation(summary = "Todos los candidatos a las vacantes de mi empresa")
    public List<PerfilLaboralDto> todos(Authentication auth) {
        return servicio.todos(acceso.empresaDe(auth));
    }

    @GetMapping("/vacante/{vacanteId}")
    @Operation(summary = "Candidatos a una vacante concreta")
    public List<PerfilLaboralDto> deVacante(@PathVariable UUID vacanteId, Authentication auth) {
        return servicio.deVacante(vacanteId, acceso.empresaDe(auth));
    }

    @PatchMapping("/{postulacionId}")
    @Operation(summary = "Mover el estado de una candidatura; la contratacion la confirma el equipo")
    public PerfilLaboralDto mover(@PathVariable UUID postulacionId,
                                  @Valid @RequestBody MoverPostulacion cambio,
                                  Authentication auth) {
        return servicio.mover(postulacionId, acceso.empresaDe(auth),
                cambio.estado(), cambio.comentario());
    }

    /**
     * Cita, desde el lado de la empresa.
     *
     * <p>No lleva estado: poner fecha ya significa citar, y el dominio lo
     * deduce. Tampoco lleva el correo del contacto —lo tiene la cuenta con la
     * que se entro— para no acabar con dos direcciones del mismo interlocutor.
     */
    public record AgendarCita(
            java.time.LocalDateTime fechaHoraEntrevista,
            com.novacrm.postulacion.ModalidadEntrevista modalidad,
            @Size(max = 1000) String lugar,
            @Size(max = 160) String contactoNombre,
            @Size(max = 40) String contactoTelefono,
            Boolean cancelar) {}

    @PostMapping("/{postulacionId}/cita")
    @Operation(summary = "Agendar, mover o cancelar la entrevista de una candidatura")
    public PerfilLaboralDto agendar(@PathVariable UUID postulacionId,
                                    @Valid @RequestBody AgendarCita cuerpo,
                                    Authentication auth) {
        return servicio.agendar(postulacionId, acceso.empresaDe(auth),
                new PortalPostulanteService.CitaDeLaEmpresa(
                        cuerpo.fechaHoraEntrevista(), cuerpo.modalidad(), cuerpo.lugar(),
                        cuerpo.contactoNombre(), cuerpo.contactoTelefono(), cuerpo.cancelar()));
    }
}
