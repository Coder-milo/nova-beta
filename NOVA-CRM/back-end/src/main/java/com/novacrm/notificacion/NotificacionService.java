package com.novacrm.notificacion;

import com.novacrm.auth.OwnershipService;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.matching.Match;
import com.novacrm.matching.MatchRepository;
import com.novacrm.notificacion.dto.NotificacionResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class NotificacionService {

    private final NotificacionRepository notificacionRepository;
    private final MatchRepository matchRepository;
    private final OwnershipService ownershipService;

    public NotificacionService(NotificacionRepository notificacionRepository,
                               MatchRepository matchRepository,
                               OwnershipService ownershipService) {
        this.notificacionRepository = notificacionRepository;
        this.matchRepository = matchRepository;
        this.ownershipService = ownershipService;
    }

    public Page<NotificacionResponse> obtenerNotificaciones(UUID estudianteId, Pageable pageable) {
        return notificacionRepository.findByEstudianteIdOrderByCreatedAtDesc(estudianteId, pageable)
                .map(this::toResponse);
    }

    private NotificacionResponse toResponse(Notificacion n) {
        return new NotificacionResponse(
                n.getId(), n.getTitulo(), n.getMensaje(), n.getTipo(),
                n.getReferenciaId(), n.isLeida(), n.getCreatedAt());
    }

    public long contarNoLeidas(UUID estudianteId) {
        return notificacionRepository.countByEstudianteIdAndLeidaFalse(estudianteId);
    }

    @Transactional
    public void marcarLeida(UUID id, Authentication auth) {
        var notificacion = notificacionRepository.findById(id)
                .orElseThrow(() -> new com.novacrm.exception.ResourceNotFoundException("Notificacion no encontrada: " + id));
        ownershipService.verificarAccesoEstudiante(auth, notificacion.getEstudiante().getId());
        notificacion.setLeida(true);
        notificacionRepository.save(notificacion);
    }

    @Transactional
    public void generarNotificacionesMatch(List<Match> matches) {
        for (Match match : matches) {
            var notificacion = new Notificacion();
            notificacion.setTitulo("Nueva vacante recomendada");
            notificacion.setMensaje("Se ha encontrado una vacante que coincide con tu perfil: " + match.getVacante().getTitulo());
            notificacion.setEstudiante(match.getEstudiante());
            notificacion.setTipo("MATCH");
            notificacion.setReferenciaId(match.getId().toString());
            notificacionRepository.save(notificacion);
            match.setNotificado(true);
            matchRepository.save(match);
        }
    }
}
