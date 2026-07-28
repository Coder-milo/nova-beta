package com.novacrm.seguimiento;

import com.novacrm.seguimiento.dto.SeguimientoResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Tablero de seguimiento de estudiantes.
 *
 * <p>Solo COORDINADOR y ADMIN: el tablero muestra a todos los estudiantes del
 * programa a la vez, que es justo lo que un estudiante no puede ver.
 */
@RestController
@RequestMapping("/api/v1/seguimiento/tablero")
@Tag(name = "Tablero de seguimiento",
     description = "Estado de contacto por estudiante, con la etapa del pipeline al lado")
public class TableroController {

    private final TableroService tableroService;

    public TableroController(TableroService tableroService) {
        this.tableroService = tableroService;
    }

    /** Lo que manda el frontend al soltar una tarjeta en otra columna. */
    public record MoverRequest(EstadoContacto estado, String observacion) {}

    @GetMapping
    @Operation(summary = "Tablero completo, agrupado por estado de contacto")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public TableroService.Tablero tablero() {
        return tableroService.construir();
    }

    /**
     * Mueve un estudiante a otra columna.
     *
     * <p>El responsable sale de la sesion y no del cuerpo de la peticion: quien
     * movio la tarjeta es un dato de auditoria y no algo que el cliente deba
     * poder escribir.
     */
    @PutMapping("/{estudianteId}")
    @Operation(summary = "Cambiar el estado de contacto de un estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public TarjetaTablero mover(@PathVariable UUID estudianteId,
                                @RequestBody MoverRequest request,
                                Authentication auth) {
        return tableroService.mover(
                estudianteId,
                request.estado(),
                auth == null ? null : auth.getName(),
                request.observacion());
    }

    @GetMapping("/{estudianteId}/historial")
    @Operation(summary = "Historial de seguimiento de un estudiante")
    @PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
    public List<SeguimientoResponse> historial(@PathVariable UUID estudianteId) {
        return tableroService.historial(estudianteId);
    }
}
