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
    private final com.novacrm.auditoria.AuditoriaService auditoriaService;

    public ReportesDeChatController(ReporteDeChatRepository repository,
                                    com.novacrm.auditoria.AuditoriaService auditoriaService) {
        this.repository = repository;
        this.auditoriaService = auditoriaService;
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

    /**
     * Cierra un reporte.
     *
     * <p>Queda en auditoría quién lo cerró y cuándo. Aquí alguien decide que una
     * denuncia ya está atendida, y hasta ahora esa decisión no dejaba rastro:
     * el registro de auditoría cubría editar una empresa pero no cerrar la
     * queja de un estudiante sobre otro. Si mañana hay que responder por cómo
     * se llevó un caso, esto es lo único que lo cuenta.
     *
     * <p>No se copia el extracto al registro: ya está en el reporte, y
     * duplicar una conversación privada en una segunda tabla es repartir lo
     * mismo por más sitios sin ganar nada.
     */
    @PostMapping("/{id}/revisado")
    @Operation(summary = "Marcar un reporte como revisado")
    @Transactional
    public ReporteResponse marcarRevisado(@PathVariable UUID id) {
        var reporte = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reporte no encontrado: " + id));
        String estadoAnterior = reporte.getEstado();
        reporte.setEstado(ReporteDeChat.REVISADO);
        var guardado = repository.save(reporte);
        auditoriaService.registrar("CHAT", "REPORTE_REVISADO", "ReporteDeChat",
                id.toString(),
                nombreDe(reporte.getDenunciante()) + " sobre " + nombreDe(reporte.getDenunciado()),
                "{\"estado\":\"" + estadoAnterior + "\"}",
                "{\"estado\":\"" + ReporteDeChat.REVISADO + "\"}");
        return aRespuesta(guardado);
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
