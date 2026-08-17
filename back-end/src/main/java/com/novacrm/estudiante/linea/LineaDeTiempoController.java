package com.novacrm.estudiante.linea;

import com.novacrm.auth.OwnershipService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * La historia de un estudiante en orden cronológico.
 *
 * <p>Un estudiante puede ver la suya; el equipo, la de cualquiera. Pasa por
 * {@code OwnershipService} igual que el resto del módulo: la regla por URL sabe
 * quién pregunta pero no de quién es la ficha.
 */
@RestController
@RequestMapping("/api/v1/estudiantes/{estudianteId}/linea-de-tiempo")
@Tag(name = "Estudiantes", description = "Historia unificada de un participante")
public class LineaDeTiempoController {

    private final LineaDeTiempoService servicio;
    private final OwnershipService ownership;

    public LineaDeTiempoController(LineaDeTiempoService servicio, OwnershipService ownership) {
        this.servicio = servicio;
        this.ownership = ownership;
    }

    @GetMapping
    @Operation(summary = "Postulaciones, entrevistas, seguimiento, documentos y colocaciones en una sola lista")
    @PreAuthorize("hasAnyRole('ESTUDIANTE', 'COORDINADOR', 'ADMIN')")
    public List<HitoDeLaLinea> linea(@PathVariable UUID estudianteId, Authentication auth) {
        ownership.verificarAccesoEstudiante(auth, estudianteId);
        return servicio.de(estudianteId);
    }
}
