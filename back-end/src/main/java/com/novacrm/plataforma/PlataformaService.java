package com.novacrm.plataforma;

import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.plataforma.dto.PlataformaAsignacionRequest;
import com.novacrm.plataforma.dto.PlataformaRequest;
import com.novacrm.plataforma.dto.PlataformaResponse;
import com.novacrm.programa.ProgramaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class PlataformaService {

    private final PlataformaRepository plataformaRepository;
    private final ProgramaPlataformaRepository programaPlataformaRepository;
    private final EstudiantePlataformaRepository estudiantePlataformaRepository;
    private final ProgramaRepository programaRepository;
    private final EstudianteRepository estudianteRepository;

    public PlataformaService(PlataformaRepository plataformaRepository,
                             ProgramaPlataformaRepository programaPlataformaRepository,
                             EstudiantePlataformaRepository estudiantePlataformaRepository,
                             ProgramaRepository programaRepository,
                             EstudianteRepository estudianteRepository) {
        this.plataformaRepository = plataformaRepository;
        this.programaPlataformaRepository = programaPlataformaRepository;
        this.estudiantePlataformaRepository = estudiantePlataformaRepository;
        this.programaRepository = programaRepository;
        this.estudianteRepository = estudianteRepository;
    }

    // ── Catálogo ────────────────────────────────────────────────────────────

    public List<PlataformaResponse> catalogo() {
        return plataformaRepository.findAllByActivoTrueOrderByNombreAsc()
                .stream().map(this::toResponse).toList();
    }

    public PlataformaResponse crear(PlataformaRequest request) {
        if (plataformaRepository.findByCodigo(request.codigo()).isPresent()) {
            throw new BusinessException("Ya existe una plataforma con el código " + request.codigo());
        }
        var p = new Plataforma();
        p.setCodigo(request.codigo());
        p.setNombre(request.nombre());
        p.setUrl(request.url());
        p.setIconoUrl(request.iconoUrl());
        return toResponse(plataformaRepository.save(p));
    }

    public PlataformaResponse actualizar(UUID id, PlataformaRequest request) {
        var p = plataformaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Plataforma no encontrada: " + id));
        plataformaRepository.findByCodigo(request.codigo())
                .filter(otra -> !otra.getId().equals(id))
                .ifPresent(otra -> {
                    throw new BusinessException("Ya existe una plataforma con el código " + request.codigo());
                });
        p.setCodigo(request.codigo());
        p.setNombre(request.nombre());
        p.setUrl(request.url());
        p.setIconoUrl(request.iconoUrl());
        return toResponse(plataformaRepository.save(p));
    }

    /**
     * Borrado suave. La plataforma deja de aparecer y de poder asignarse,
     * pero las asignaciones que ya existen no se tocan; quitar plataformas a
     * los estudiantes se hace desde su ficha, donde el equipo puede ver la
     * lista completa en lugar de enterarse por una destrucción silenciosa.
     */
    public void eliminar(UUID id) {
        var p = plataformaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("plataforma no encontrada: " + id));
        p.setActivo(false);
        plataformaRepository.save(p);
    }

    // ── Asignación por programa ─────────────────────────────────────────────

    /**
     * Asigna el conjunto completo de plataformas que el programa ofrece.
     * Reemplazo total: quita lo que dejó de tocar y agrega lo nuevo.
     */
    @Transactional
    public void asignarPrograma(UUID programaId, PlataformaAsignacionRequest request) {
        programaRepository.findById(programaId)
                .orElseThrow(() -> new ResourceNotFoundException("Programa no encontrado: " + programaId));
        if (request.plataformaIds() == null) {
            throw new BusinessException("La lista de plataformas no puede estar vacía");
        }
        Set<UUID> pedidas = new HashSet<>(request.plataformaIds());
        var existentes = plataformaRepository.findAllById(pedidas);
        if (existentes.size() != pedidas.size() || existentes.stream().anyMatch(p -> !p.isActivo())) {
            throw new BusinessException("Solo se puede asignar plataformas activas del catálogo");
        }
        var actuales = programaPlataformaRepository.findByProgramaId(programaId);
        for (var row : actuales) {
            if (!pedidas.contains(row.getPlataformaId())) {
                programaPlataformaRepository.delete(row);
            }
        }
        for (var id : pedidas) {
            if (actuales.stream().noneMatch(r -> r.getPlataformaId().equals(id))) {
                var row = new ProgramaPlataforma();
                row.setProgramaId(programaId);
                row.setPlataformaId(id);
                programaPlataformaRepository.save(row);
            }
        }
    }

    /** Plataformas del catálogo visibles en un programa. */
    public List<PlataformaResponse> plataformasDePrograma(UUID programaId) {
        var ids = programaPlataformaRepository.findPlataformaIdsByProgramaId(programaId).stream().collect(Collectors.toSet());
        if (ids.isEmpty()) return List.of();
        return ordenar(plataformaRepository.findAllById(ids));
    }

    // ── Asignación por estudiante ───────────────────────────────────────────

    /**
     * Asigna el conjunto completo de plataformas de un estudiante: agrega y
     * quita lo que ya no toca. El estudiante solo puede recibir plataformas
     * que el programa tenga activas — si el programa no la ofrece, aparece un
     * error en vez de guardar algo que el portal no podría servir.
     */
    @Transactional
    public void asignarEstudiante(UUID estudianteId, PlataformaAsignacionRequest request) {
        var estudiante = estudianteRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado: " + estudianteId));
        if (request.plataformaIds() == null) {
            throw new BusinessException("La lista de plataformas no puede estar vacía");
        }
        Set<UUID> pedidas = new HashSet<>(request.plataformaIds());
        UUID programaId = estudiante.getPrograma() != null ? estudiante.getPrograma().getId() : null;
        if (programaId != null) {
            Set<UUID> delPrograma = new HashSet<>(programaPlataformaRepository.findPlataformaIdsByProgramaId(programaId));
            if (!delPrograma.containsAll(pedidas)) {
                throw new BusinessException("Solo se puede asignar plataformas que el programa del estudiante ofrezca");
            }
        }
        var actuales = estudiantePlataformaRepository.findByEstudianteId(estudianteId);
        for (var row : actuales) {
            if (!pedidas.contains(row.getPlataformaId())) {
                estudiantePlataformaRepository.delete(row);
            }
        }
        for (var id : pedidas) {
            if (actuales.stream().noneMatch(r -> r.getPlataformaId().equals(id))) {
                var row = new EstudiantePlataforma();
                row.setEstudianteId(estudianteId);
                row.setPlataformaId(id);
                estudiantePlataformaRepository.save(row);
            }
        }
    }

    /**
     * Las plataformas pertenecen al proyecto (programa). Todo estudiante del
     * proyecto las hereda automáticamente.
     */
    public List<PlataformaResponse> plataformasDeEstudiante(UUID estudianteId) {
        var estudiante = estudianteRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado: " + estudianteId));
        if (estudiante.getPrograma() == null) {
            return List.of();
        }
        return plataformasDePrograma(estudiante.getPrograma().getId());
    }

    /**
     * El portal del estudiante enseña las plataformas activas asociadas al
     * proyecto (programa) en el que está inscrito el estudiante.
     */
    public List<PlataformaResponse> plataformasDeEstudiantePorEmail(String email) {
        var est = estudianteRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado para la sesion actual"));
        if (est.getPrograma() == null) {
            return List.of();
        }
        return plataformasDePrograma(est.getPrograma().getId()).stream()
                .filter(PlataformaResponse::activo)
                .toList();
    }

    private List<PlataformaResponse> ordenar(List<Plataforma> lista) {
        return lista.stream().map(this::toResponse)
                .sorted(Comparator.comparing(PlataformaResponse::nombre))
                .toList();
    }

    private PlataformaResponse toResponse(Plataforma p) {
        return new PlataformaResponse(p.getId(), p.getCodigo(), p.getNombre(), p.getUrl(), p.getIconoUrl(), p.isActivo());
    }
}