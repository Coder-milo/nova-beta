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
    private final com.novacrm.auditoria.AuditoriaService auditoriaService;

    @PersistenceContext
    private EntityManager entityManager;

    public EstudianteService(EstudianteRepository estudianteRepository,
                             ProgramaRepository programaRepository,
                             NivelInglesRepository nivelInglesRepository,
                             com.novacrm.auditoria.AuditoriaService auditoriaService) {
        this.estudianteRepository = estudianteRepository;
        this.programaRepository = programaRepository;
        this.nivelInglesRepository = nivelInglesRepository;
        this.auditoriaService = auditoriaService;
    }

    public Page<EstudianteResponse> listarPorPrograma(UUID programaId, Pageable pageable) {
        return estudianteRepository.findByProgramaIdAndActivoTrue(programaId, pageable)
                .map(this::toResponse);
    }

    public Page<EstudianteResponse> listarConDatosFaltantes(Pageable pageable) {
        return estudianteRepository.buscarActivosConDatosFaltantes(pageable)
                .map(this::toResponse);
    }

    /** Búsqueda avanzada sin exigir programa: nombre/documento/email, ciudad y estados. */
    public Page<EstudianteResponse> buscarAvanzado(String q, UUID programaId, String ciudad,
                                                   EstadoAcademico estadoAcademico,
                                                   EstadoEmpleabilidad estadoEmpleabilidad,
                                                   Pageable pageable) {
        return estudianteRepository.buscarAvanzado(
                        (q == null || q.isBlank()) ? null : q.trim(),
                        programaId,
                        (ciudad == null || ciudad.isBlank()) ? null : ciudad.trim(),
                        estadoAcademico, estadoEmpleabilidad, pageable)
                .map(this::toResponse);
    }

    /** Vincular (mover) un estudiante a otro programa. */
    @Transactional
    public EstudianteResponse vincularPrograma(UUID id, UUID programaId) {
        var estudiante = buscar(id);
        var programa = programaRepository.findById(programaId)
                .orElseThrow(() -> new ResourceNotFoundException("Programa no encontrado: " + programaId));
        estudiante.setPrograma(programa);
        return toResponse(estudianteRepository.save(estudiante));
    }

    @Transactional
    public EstudianteResponse actualizarFoto(UUID id, String fotoUrl) {
        var estudiante = buscar(id);
        estudiante.setFotoUrl(fotoUrl);
        return toResponse(estudianteRepository.save(estudiante));
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
        var creado = estudianteRepository.save(estudiante);
        auditoriaService.registrar("Estudiantes", "Creación", "Estudiante",
                creado.getId().toString(), creado.getNombre() + " " + creado.getApellido(), null, null);
        return toResponse(creado);
    }

    @Transactional
    public EstudianteResponse actualizar(UUID id, EstudianteRequest request) {
        var estudiante = buscar(id);
        aplicarRequest(estudiante, request);
        var actualizado = estudianteRepository.save(estudiante);
        auditoriaService.registrar("Estudiantes", "Actualización", "Estudiante",
                id.toString(), actualizado.getNombre() + " " + actualizado.getApellido(), null, null);
        return toResponse(actualizado);
    }

    @Transactional
    public void softDelete(UUID id) {
        var estudiante = buscar(id);
        estudiante.setActivo(false);
        estudiante.setDeletedAt(Instant.now());
        estudianteRepository.save(estudiante);
        auditoriaService.registrar("Estudiantes", "Eliminación", "Estudiante",
                id.toString(), estudiante.getNombre() + " " + estudiante.getApellido(), null, null);
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
        e.setDireccion(r.direccion());
        e.setCompetencias(r.competencias());
        e.setIdiomas(r.idiomas());
        e.setReferencias(r.referencias());
        e.setDisponibilidad(r.disponibilidad());
    }

    /** Porcentaje de perfil completado: campos clave para generar una HV de calidad. */
    private static int calcularCompletitud(Estudiante e) {
        String[] campos = {
                e.getNombre(), e.getApellido(), e.getEmail(),
                e.getCelular() != null ? e.getCelular() : e.getTelefono(),
                e.getNumeroDocumento(), e.getCiudad(), e.getDireccion(),
                e.getPerfilProfesional(), e.getNivelEducativo(), e.getTitulo(),
                e.getCargoObjetivo(), e.getCompetencias()
        };
        int llenos = 0;
        for (var c : campos) if (c != null && !c.isBlank()) llenos++;
        return Math.round(llenos * 100f / campos.length);
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
                e.isActivo(), e.getCreatedAt(), e.getDeletedAt(),
                e.getDireccion(), e.getFotoUrl(), e.getCompetencias(),
                e.getIdiomas(), e.getReferencias(), e.getDisponibilidad(),
                calcularCompletitud(e)
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
