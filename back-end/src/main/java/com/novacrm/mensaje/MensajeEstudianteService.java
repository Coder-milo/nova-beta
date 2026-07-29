package com.novacrm.mensaje;

import com.novacrm.auth.OwnershipService;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.mensaje.dto.MensajeRequest;
import com.novacrm.mensaje.dto.MensajeResponse;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class MensajeEstudianteService {
    private final MensajeEstudianteRepository repository;
    private final OwnershipService ownershipService;

    public MensajeEstudianteService(MensajeEstudianteRepository repository, OwnershipService ownershipService) {
        this.repository = repository;
        this.ownershipService = ownershipService;
    }

    public List<MensajeResponse> mios(Authentication auth) {
        return repository.findByEstudianteIdOrderByCreatedAtDesc(
                ownershipService.obtenerEstudianteAutenticado(auth).getId()).stream().map(this::toResponse).toList();
    }

    @Transactional
    public MensajeResponse crear(MensajeRequest request, Authentication auth) {
        var mensaje = new MensajeEstudiante();
        mensaje.setEstudiante(ownershipService.obtenerEstudianteAutenticado(auth));
        mensaje.setAsunto(request.asunto().trim());
        mensaje.setContenido(request.contenido().trim());
        return toResponse(repository.save(mensaje));
    }

    public List<MensajeResponse> listarTodos() {
        return repository.findAllByOrderByCreatedAtDesc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public MensajeResponse responder(UUID id, String respuesta, Authentication auth) {
        var mensaje = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Mensaje no encontrado: " + id));
        mensaje.setRespuesta(respuesta.trim());
        mensaje.setRespondidoPor(auth.getName());
        mensaje.setRespondidoAt(Instant.now());
        mensaje.setEstado(EstadoMensaje.RESPONDIDO);
        return toResponse(repository.save(mensaje));
    }

    private MensajeResponse toResponse(MensajeEstudiante mensaje) {
        var estudiante = mensaje.getEstudiante();
        String nombre = ((estudiante.getNombre() == null ? "" : estudiante.getNombre()) + " "
                + (estudiante.getApellido() == null ? "" : estudiante.getApellido())).trim();
        return new MensajeResponse(mensaje.getId(), estudiante.getId(),
                nombre.isBlank() ? estudiante.getEmail() : nombre, estudiante.getEmail(),
                mensaje.getAsunto(), mensaje.getContenido(),
                mensaje.getEstado().name(), mensaje.getCreatedAt(), mensaje.getRespuesta(),
                mensaje.getRespondidoPor(), mensaje.getRespondidoAt());
    }
}
