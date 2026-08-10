package com.novacrm.chat;

import com.novacrm.exception.ResourceNotFoundException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

/**
 * La bandeja de reportes del chat, para el equipo de acompañamiento.
 *
 * <p>Solo coordinación y administración. Lo que se ve aquí es el extracto que se
 * copió al reportar, no la conversación en vivo: el equipo lee lo que el
 * estudiante decidió enseñar al pedir ayuda, y nada más.
 */
@RestController
@RequestMapping("/api/v1/chats/reportes")
@Tag(name = "Chat", description = "Reportes del chat entre estudiantes")
@PreAuthorize("hasAnyRole('COORDINADOR', 'ADMIN')")
public class ReportesDeChatController {

    private final ReporteDeChatRepository repository;

    public ReportesDeChatController(ReporteDeChatRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    @Operation(summary = "Reportes del chat, los abiertos primero")
    @Transactional(readOnly = true)
    public Page<ReporteResponse> listar(@RequestParam(required = false) String estado,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "20") int size) {
        var pagina = PageRequest.of(page, Math.min(size, 100));
        var reportes = estado == null || estado.isBlank()
                ? repository.findAllByOrderByCreatedAtDesc(pagina)
                : repository.findByEstadoOrderByCreatedAtDesc(estado.trim().toUpperCase(), pagina);
        return reportes.map(ReportesDeChatController::aRespuesta);
    }

    @PostMapping("/{id}/revisado")
    @Operation(summary = "Marcar un reporte como revisado")
    @Transactional
    public ReporteResponse marcarRevisado(@PathVariable UUID id) {
        var reporte = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reporte no encontrado: " + id));
        reporte.setEstado(ReporteDeChat.REVISADO);
        return aRespuesta(repository.save(reporte));
    }

    private static ReporteResponse aRespuesta(ReporteDeChat r) {
        return new ReporteResponse(
                r.getId(),
                r.getDenunciante().getId(), nombreDe(r.getDenunciante()),
                r.getDenunciado().getId(), nombreDe(r.getDenunciado()),
                r.getMotivo(), r.getExtracto(), r.getEstado(), r.getCreatedAt());
    }

    private static String nombreDe(com.novacrm.estudiante.Estudiante estudiante) {
        String nombre = ((estudiante.getNombre() == null ? "" : estudiante.getNombre()) + " "
                + (estudiante.getApellido() == null ? "" : estudiante.getApellido())).trim();
        return nombre.isBlank() ? "Estudiante CAC" : nombre;
    }

    public record ReporteResponse(
            UUID id,
            UUID denuncianteId, String denunciante,
            UUID denunciadoId, String denunciado,
            String motivo, String extracto, String estado, Instant fecha) {}
}
