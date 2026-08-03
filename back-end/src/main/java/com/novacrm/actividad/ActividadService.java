package com.novacrm.actividad;

import com.novacrm.actividad.dto.ActividadRequest;
import com.novacrm.actividad.dto.ActividadResponse;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.programa.ProgramaRepository;
import com.novacrm.auth.OwnershipService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.Authentication;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ActividadService {

    private final ActividadRepository actividadRepository;
    private final ProgramaRepository programaRepository;
    private final OwnershipService ownershipService;

    public ActividadService(ActividadRepository actividadRepository,
                            ProgramaRepository programaRepository,
                            OwnershipService ownershipService) {
        this.actividadRepository = actividadRepository;
        this.programaRepository = programaRepository;
        this.ownershipService = ownershipService;
    }

    public List<ActividadResponse> listar(UUID programaId) {
        return actividadRepository.findByProgramaIdOrderByFechaAsc(programaId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public List<ActividadResponse> proximas() {
        return actividadRepository.findTop10ByEstadoNotAndFechaGreaterThanEqualOrderByFechaAscHoraAsc(
                        "COMPLETADA", LocalDate.now())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public List<ActividadResponse> listarAgenda() {
        return actividadRepository.findAllByOrderByFechaAscHoraAsc()
                .stream().map(this::toResponse).toList();
    }

    /** Agenda del participante: eventos globales y solo los de su programa. */
    public List<ActividadResponse> mias(Authentication auth) {
        var programaId = ownershipService.programaDelEstudianteAutenticado(auth);
        return actividadRepository.findVisiblesParaPrograma(programaId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public ActividadResponse crear(UUID programaId, ActividadRequest request) {
        var programa = programaRepository.findById(programaId)
                .orElseThrow(() -> new ResourceNotFoundException("Programa no encontrado: " + programaId));
        var actividad = new Actividad();
        actividad.setPrograma(programa);
        aplicar(actividad, request);
        return toResponse(actividadRepository.save(actividad));
    }

    @Transactional
    public ActividadResponse crear(ActividadRequest request) {
        var actividad = new Actividad();
        actividad.setPrograma(resolverPrograma(request.programaId()));
        aplicar(actividad, request);
        return toResponse(actividadRepository.save(actividad));
    }

    @Transactional
    public ActividadResponse actualizar(UUID programaId, UUID id, ActividadRequest request) {
        var actividad = buscar(programaId, id);
        aplicar(actividad, request);
        return toResponse(actividadRepository.save(actividad));
    }

    @Transactional
    public ActividadResponse actualizar(UUID id, ActividadRequest request) {
        var actividad = actividadRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Actividad no encontrada: " + id));
        actividad.setPrograma(resolverPrograma(request.programaId()));
        aplicar(actividad, request);
        return toResponse(actividadRepository.save(actividad));
    }

    @Transactional
    public ActividadResponse alternarCompletada(UUID id) {
        var actividad = actividadRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Actividad no encontrada: " + id));
        actividad.setEstado("COMPLETADA".equalsIgnoreCase(actividad.getEstado())
                ? "PENDIENTE" : "COMPLETADA");
        return toResponse(actividadRepository.save(actividad));
    }

    @Transactional
    public void eliminar(UUID id) {
        var actividad = actividadRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Actividad no encontrada: " + id));
        actividadRepository.delete(actividad);
    }

    @Transactional
    public void eliminar(UUID programaId, UUID id) {
        var actividad = buscar(programaId, id);
        actividadRepository.delete(actividad);
    }

    private Actividad buscar(UUID programaId, UUID id) {
        var actividad = actividadRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Actividad no encontrada: " + id));
        if (!actividad.getPrograma().getId().equals(programaId)) {
            throw new ResourceNotFoundException("Actividad no encontrada para el programa: " + programaId);
        }
        return actividad;
    }

    private void aplicar(Actividad actividad, ActividadRequest request) {
        actividad.setNombre(request.nombre());
        actividad.setFecha(request.fecha());
        actividad.setHora(request.hora());
        actividad.setDescripcion(request.descripcion());
        actividad.setCategoria(request.categoria() != null && !request.categoria().isBlank()
                ? request.categoria().trim().toUpperCase() : "GENERAL");
        actividad.setResponsable(request.responsable());
        actividad.setEstado(request.estado() != null ? request.estado() : "PENDIENTE");
    }

    private com.novacrm.programa.Programa resolverPrograma(UUID programaId) {
        if (programaId == null) return null;
        return programaRepository.findById(programaId)
                .orElseThrow(() -> new ResourceNotFoundException("Programa no encontrado: " + programaId));
    }

    private ActividadResponse toResponse(Actividad a) {
        return new ActividadResponse(
                a.getId(),
                a.getPrograma() != null ? a.getPrograma().getId() : null,
                a.getPrograma() != null ? a.getPrograma().getNombre() : null,
                a.getNombre(), a.getFecha(), a.getHora(), a.getDescripcion(),
                a.getCategoria(), a.getResponsable(), a.getEstado()
        );
    }
}
