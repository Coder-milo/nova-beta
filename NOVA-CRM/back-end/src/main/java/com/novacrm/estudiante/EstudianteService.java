package com.novacrm.estudiante;

import com.novacrm.catalogo.nivel_ingles.NivelInglesRepository;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.estudiante.dto.EstudianteRequest;
import com.novacrm.estudiante.dto.EstudianteResponse;
import com.novacrm.programa.ProgramaRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class EstudianteService {

    private final EstudianteRepository estudianteRepository;
    private final ProgramaRepository programaRepository;
    private final NivelInglesRepository nivelInglesRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public EstudianteService(EstudianteRepository estudianteRepository,
                             ProgramaRepository programaRepository,
                             NivelInglesRepository nivelInglesRepository) {
        this.estudianteRepository = estudianteRepository;
        this.programaRepository = programaRepository;
        this.nivelInglesRepository = nivelInglesRepository;
    }

    public Page<EstudianteResponse> listarPorPrograma(UUID programaId, Pageable pageable) {
        return estudianteRepository.findByProgramaIdAndActivoTrue(programaId, pageable)
                .map(this::toResponse);
    }

    public EstudianteResponse obtener(UUID id) {
        return toResponse(buscar(id));
    }

    @Transactional
    public EstudianteResponse crear(EstudianteRequest request) {
        var programa = programaRepository.findById(request.programaId())
                .orElseThrow(() -> new ResourceNotFoundException("Programa no encontrado"));
        var estudiante = new Estudiante();
        aplicarRequest(estudiante, request);
        estudiante.setPrograma(programa);
        return toResponse(estudianteRepository.save(estudiante));
    }

    @Transactional
    public EstudianteResponse actualizar(UUID id, EstudianteRequest request) {
        var estudiante = buscar(id);
        aplicarRequest(estudiante, request);
        return toResponse(estudianteRepository.save(estudiante));
    }

    @Transactional
    public void softDelete(UUID id) {
        var estudiante = buscar(id);
        estudiante.setActivo(false);
        estudiante.setDeletedAt(Instant.now());
        estudianteRepository.save(estudiante);
    }

    public Page<EstudianteResponse> listarPapelera(UUID programaId, Pageable pageable) {
        return estudianteRepository.findByProgramaIdAndActivoFalse(programaId, pageable)
                .map(this::toResponse);
    }

    @Transactional
    public EstudianteResponse restaurar(UUID id) {
        var estudiante = estudianteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado: " + id));
        if (estudiante.isActivo()) {
            throw new com.novacrm.exception.BusinessException("El estudiante ya está activo");
        }
        estudiante.setActivo(true);
        estudiante.setDeletedAt(null);
        return toResponse(estudianteRepository.save(estudiante));
    }

    public long contarPapelera(UUID programaId) {
        return estudianteRepository.countByProgramaIdAndActivoFalse(programaId);
    }

    public long contarPorPrograma(UUID programaId) {
        return estudianteRepository.countByProgramaIdAndActivoTrue(programaId);
    }

    private Estudiante buscar(UUID id) {
        return estudianteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Estudiante no encontrado: " + id));
    }

    private void aplicarRequest(Estudiante e, EstudianteRequest r) {
        e.setNombre(r.nombre());
        e.setApellido(r.apellido());
        e.setEmail(r.email());
        e.setTelefono(r.telefono());
        e.setCelular(r.celular());
        e.setCiudad(r.ciudad());
        e.setBarrio(r.barrio());
        e.setTipoDocumento(r.tipoDocumento());
        e.setNumeroDocumento(r.numeroDocumento());
        e.setGenero(r.genero());
        e.setNacionalidad(r.nacionalidad());
        e.setNivelEducativo(r.nivelEducativo());
        e.setTitulo(r.titulo());
        e.setAniosExperiencia(r.aniosExperiencia());
        e.setSectorExperiencia(r.sectorExperiencia());
        e.setUltimoCargo(r.ultimoCargo());
        e.setPerfilProfesional(r.perfilProfesional());
        e.setSectorObjetivo(r.sectorObjetivo());
        e.setCargoObjetivo(r.cargoObjetivo());
        e.setDisponibilidadMovilidad(r.disponibilidadMovilidad());
        e.setClasificacionSisben(r.clasificacionSisben());
        e.setSituacionLaboral(r.situacionLaboral());
        e.setIngresoMensual(r.ingresoMensual());
        e.setResponsableEconomico(r.responsableEconomico());
        e.setHaTrabajado(r.haTrabajado());
        e.setTieneComputador(r.tieneComputador());
        e.setTieneInternet(r.tieneInternet());
        e.setMotivacion(r.motivacion());
        e.setInteresMigratorio(r.interesMigratorio());
        e.setResultadoPruebaEscrita(r.resultadoPruebaEscrita());
        e.setResultadoPruebaOral(r.resultadoPruebaOral());
        e.setInstitucionEducativa(r.institucionEducativa());
        e.setProgramaAcademico(r.programaAcademico());
        e.setAreaFormacion(r.areaFormacion());
        e.setEstadoFormacion(r.estadoFormacion());
        e.setDisponibilidadLaboral(r.disponibilidadLaboral());
        e.setEstadoBusqueda(r.estadoBusqueda());
        e.setPostulacionesEnviadas(r.postulacionesEnviadas());
        e.setEmpresasContactadas(r.empresasContactadas());
        if (r.estadoAcademico() != null) e.setEstadoAcademico(r.estadoAcademico());
        if (r.estadoEmpleabilidad() != null) e.setEstadoEmpleabilidad(r.estadoEmpleabilidad());
    }

    private EstudianteResponse toResponse(Estudiante e) {
        return new EstudianteResponse(
                e.getId(), e.getNombre(), e.getApellido(), e.getEmail(),
                e.getTelefono(), e.getCelular(), e.getCiudad(), e.getBarrio(),
                e.getTipoDocumento(), e.getNumeroDocumento(),
                e.getNivelEducativo(), e.getTitulo(), e.getAniosExperiencia(),
                e.getSectorExperiencia(), e.getUltimoCargo(), e.getPerfilProfesional(),
                e.getSectorObjetivo(), e.getCargoObjetivo(), e.getDisponibilidadMovilidad(),
                e.getNacionalidad(), e.getClasificacionSisben(), e.getSituacionLaboral(),
                e.getIngresoMensual(), e.getResponsableEconomico(), e.getHaTrabajado(),
                e.getTieneComputador(), e.getTieneInternet(), e.getMotivacion(),
                e.getInteresMigratorio(), e.getResultadoPruebaEscrita(), e.getResultadoPruebaOral(),
                e.getInstitucionEducativa(), e.getProgramaAcademico(), e.getAreaFormacion(),
                e.getEstadoFormacion(), e.getDisponibilidadLaboral(), e.getEstadoBusqueda(),
                e.getPostulacionesEnviadas(), e.getEmpresasContactadas(),
                e.getEstadoAcademico(), e.getEstadoEmpleabilidad(),
                e.getNivelIngles() != null ? e.getNivelIngles().getNombre() : null,
                e.getPrograma().getId(), e.getPrograma().getNombre(),
                e.isActivo(), e.getCreatedAt(), e.getDeletedAt()
        );
    }

    @Transactional
    public void softDeleteMasivo(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) return;
        estudianteRepository.findAllById(ids).forEach(estudiante -> {
            estudiante.setActivo(false);
            estudiante.setDeletedAt(Instant.now());
            estudianteRepository.save(estudiante);
        });
    }

    @Transactional
    public void hardDeleteMasivo(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) return;

        entityManager.createQuery(
                "DELETE FROM Credencial c WHERE c.id IN (SELECT ec.id FROM EstudianteCertificacion ec WHERE ec.estudiante.id IN :ids)")
                .setParameter("ids", ids)
                .executeUpdate();

        entityManager.createQuery(
                "DELETE FROM Match m WHERE m.estudiante.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();

        entityManager.createQuery(
                "DELETE FROM Notificacion n WHERE n.estudiante.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();

        entityManager.createQuery(
                "DELETE FROM EstudianteHabilidad eh WHERE eh.estudiante.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();

        entityManager.createQuery(
                "DELETE FROM EstudianteCertificacion ec WHERE ec.estudiante.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();

        List<UUID> lcIds = entityManager.createQuery(
                "SELECT lc.id FROM LinkedinConfiguracion lc WHERE lc.id IN :ids", UUID.class)
                .setParameter("ids", ids)
                .getResultList();
        if (!lcIds.isEmpty()) {
            entityManager.createQuery("DELETE FROM LinkedinConfiguracion lc WHERE lc.id IN :lcIds")
                    .setParameter("lcIds", lcIds)
                    .executeUpdate();
        }

        entityManager.createQuery(
                "DELETE FROM Estudiante e WHERE e.id IN :ids")
                .setParameter("ids", ids)
                .executeUpdate();
    }
}
