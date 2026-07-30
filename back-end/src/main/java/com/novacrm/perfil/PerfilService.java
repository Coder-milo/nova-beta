package com.novacrm.perfil;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.perfil.dto.ExperienciaRequest;
import com.novacrm.perfil.dto.ExperienciaResponse;
import com.novacrm.perfil.dto.FormacionRequest;
import com.novacrm.perfil.dto.FormacionResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class PerfilService {

    private final FormacionAdicionalRepository formacionRepository;
    private final ExperienciaLaboralRepository experienciaRepository;
    private final EstudianteRepository estudianteRepository;

    public PerfilService(FormacionAdicionalRepository formacionRepository,
                         ExperienciaLaboralRepository experienciaRepository,
                         EstudianteRepository estudianteRepository) {
        this.formacionRepository = formacionRepository;
        this.experienciaRepository = experienciaRepository;
        this.estudianteRepository = estudianteRepository;
    }

    // ── Formación adicional ──────────────────────────────────────────────

    public List<FormacionResponse> listarFormaciones(UUID estudianteId) {
        return formacionRepository.findByEstudianteIdOrderByFechaInicioDesc(estudianteId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public FormacionResponse crearFormacion(UUID estudianteId, FormacionRequest request) {
        var formacion = new FormacionAdicional();
        formacion.setEstudiante(buscarEstudiante(estudianteId));
        aplicar(formacion, request);
        return toResponse(formacionRepository.save(formacion));
    }

    @Transactional
    public FormacionResponse actualizarFormacion(UUID estudianteId, UUID id, FormacionRequest request) {
        var formacion = buscarFormacion(estudianteId, id);
        aplicar(formacion, request);
        return toResponse(formacionRepository.save(formacion));
    }

    @Transactional
    public void eliminarFormacion(UUID estudianteId, UUID id) {
        formacionRepository.delete(buscarFormacion(estudianteId, id));
    }

    // ── Experiencia laboral ──────────────────────────────────────────────

    public List<ExperienciaResponse> listarExperiencias(UUID estudianteId) {
        return experienciaRepository.findByEstudianteIdOrderByFechaInicioDesc(estudianteId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ExperienciaResponse crearExperiencia(UUID estudianteId, ExperienciaRequest request) {
        var experiencia = new ExperienciaLaboral();
        experiencia.setEstudiante(buscarEstudiante(estudianteId));
        aplicar(experiencia, request);
        return toResponse(experienciaRepository.save(experiencia));
    }

    @Transactional
    public ExperienciaResponse actualizarExperiencia(UUID estudianteId, UUID id, ExperienciaRequest request) {
        var experiencia = buscarExperiencia(estudianteId, id);
        aplicar(experiencia, request);
        return toResponse(experienciaRepository.save(experiencia));
    }

    @Transactional
    public void eliminarExperiencia(UUID estudianteId, UUID id) {
        experienciaRepository.delete(buscarExperiencia(estudianteId, id));
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private Estudiante buscarEstudiante(UUID estudianteId) {
        return estudianteRepository.findById(estudianteId)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado: " + estudianteId));
    }

    private FormacionAdicional buscarFormacion(UUID estudianteId, UUID id) {
        var formacion = formacionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Formación no encontrada: " + id));
        if (!formacion.getEstudiante().getId().equals(estudianteId)) {
            throw new ResourceNotFoundException("Formación no encontrada para el estudiante: " + estudianteId);
        }
        return formacion;
    }

    private ExperienciaLaboral buscarExperiencia(UUID estudianteId, UUID id) {
        var experiencia = experienciaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Experiencia no encontrada: " + id));
        if (!experiencia.getEstudiante().getId().equals(estudianteId)) {
            throw new ResourceNotFoundException("Experiencia no encontrada para el estudiante: " + estudianteId);
        }
        return experiencia;
    }

    private void aplicar(FormacionAdicional formacion, FormacionRequest request) {
        formacion.setTipo(request.tipo());
        formacion.setInstitucion(request.institucion());
        formacion.setPrograma(request.programa());
        formacion.setFechaInicio(request.fechaInicio());
        formacion.setFechaFin(request.fechaFin());
        formacion.setEstado(request.estado());
    }

    private void aplicar(ExperienciaLaboral experiencia, ExperienciaRequest request) {
        experiencia.setEmpresa(request.empresa());
        experiencia.setCargo(request.cargo());
        experiencia.setCiudad(request.ciudad());
        experiencia.setFechaInicio(request.fechaInicio());
        experiencia.setFechaFin(request.fechaFin());
        experiencia.setRelacionada(request.relacionada());
        experiencia.setFunciones(request.funciones());
        experiencia.setActual(request.actual());
    }

    private FormacionResponse toResponse(FormacionAdicional f) {
        return new FormacionResponse(
                f.getId(), f.getTipo(), f.getInstitucion(), f.getPrograma(),
                f.getFechaInicio(), f.getFechaFin(), f.getEstado(), f.getCreatedAt()
        );
    }

    private ExperienciaResponse toResponse(ExperienciaLaboral e) {
        return new ExperienciaResponse(
                e.getId(), e.getEmpresa(), e.getCargo(), e.getCiudad(), e.getFechaInicio(), e.getFechaFin(),
                e.isRelacionada(), e.getFunciones(), e.isActual(), e.getCreatedAt()
        );
    }
}
