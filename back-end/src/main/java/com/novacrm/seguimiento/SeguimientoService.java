package com.novacrm.seguimiento;

import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.seguimiento.dto.SeguimientoRequest;
import com.novacrm.seguimiento.dto.SeguimientoResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class SeguimientoService {

    private final SeguimientoRepository seguimientoRepository;
    private final EstudianteRepository estudianteRepository;

    public SeguimientoService(SeguimientoRepository seguimientoRepository,
                              EstudianteRepository estudianteRepository) {
        this.seguimientoRepository = seguimientoRepository;
        this.estudianteRepository = estudianteRepository;
    }

    public List<SeguimientoResponse> listar(UUID estudianteId) {
        return seguimientoRepository.findByEstudianteIdOrderByFechaDesc(estudianteId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Consulta segura para el panel del estudiante autenticado. El controlador
     * recibe el correo desde el token, resuelve el estudiante y reutiliza la
     * misma consulta que usa el equipo administrativo; asi no se expone ni se
     * acepta un identificador de otro estudiante en la URL.
     */
    public List<com.novacrm.seguimiento.dto.SeguimientoDelEstudianteResponse> listarPorEmail(String email) {
        // Ignorando la caja: los correos se cargaron desde Excel tal y como
        // venian escritos y algunos llevan mayusculas. Con igualdad exacta,
        // esas personas abrian su historial de seguimiento y les decia que su
        // ficha no existe.
        var estudiante = estudianteRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado para la sesion actual"));
        return listar(estudiante.getId()).stream()
                .map(com.novacrm.seguimiento.dto.SeguimientoDelEstudianteResponse::de)
                .toList();
    }

    @Transactional
    public SeguimientoResponse crear(UUID estudianteId, SeguimientoRequest request) {
        var estudiante = estudianteRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado: " + estudianteId));
        var seguimiento = new Seguimiento();
        seguimiento.setEstudiante(estudiante);
        aplicar(seguimiento, request);
        return toResponse(seguimientoRepository.save(seguimiento));
    }

    @Transactional
    public SeguimientoResponse actualizar(UUID estudianteId, UUID id, SeguimientoRequest request) {
        var seguimiento = buscar(estudianteId, id);
        aplicar(seguimiento, request);
        return toResponse(seguimientoRepository.save(seguimiento));
    }

    @Transactional
    public void eliminar(UUID estudianteId, UUID id) {
        var seguimiento = buscar(estudianteId, id);
        seguimientoRepository.delete(seguimiento);
    }

    private Seguimiento buscar(UUID estudianteId, UUID id) {
        var seguimiento = seguimientoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Seguimiento no encontrado: " + id));
        if (!seguimiento.getEstudiante().getId().equals(estudianteId)) {
            throw new ResourceNotFoundException("Seguimiento no encontrado para el estudiante: " + estudianteId);
        }
        return seguimiento;
    }

    private void aplicar(Seguimiento seguimiento, SeguimientoRequest request) {
        seguimiento.setFecha(request.fecha() != null ? request.fecha() : LocalDate.now());
        seguimiento.setTipo(request.tipo());
        seguimiento.setResponsable(request.responsable());
        seguimiento.setObservacion(request.observacion());
        seguimiento.setProximaAccion(request.proximaAccion());
        seguimiento.setFechaProxima(request.fechaProxima());
        seguimiento.setEstado(request.estado() != null ? request.estado() : "PENDIENTE");
    }

    private SeguimientoResponse toResponse(Seguimiento s) {
        return new SeguimientoResponse(
                s.getId(), s.getFecha(), s.getTipo(), s.getResponsable(), s.getObservacion(),
                s.getProximaAccion(), s.getFechaProxima(), s.getEstado(), s.getCreatedAt()
        );
    }
}
