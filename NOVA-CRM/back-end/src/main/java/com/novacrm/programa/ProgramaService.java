package com.novacrm.programa;

import com.novacrm.estudiante.EstadoAcademico;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.programa.dto.ProgramaRequest;
import com.novacrm.programa.dto.ProgramaResponse;
import com.novacrm.programa.dto.ProgramaResumenResponse;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ProgramaService {

    private final ProgramaRepository programaRepository;
    private final EstudianteRepository estudianteRepository;
    private final com.novacrm.auditoria.AuditoriaService auditoriaService;

    @PersistenceContext
    private EntityManager entityManager;

    public ProgramaService(ProgramaRepository programaRepository,
                           EstudianteRepository estudianteRepository,
                           com.novacrm.auditoria.AuditoriaService auditoriaService) {
        this.programaRepository = programaRepository;
        this.estudianteRepository = estudianteRepository;
        this.auditoriaService = auditoriaService;
    }

    public List<ProgramaResponse> listarActivos() {
        return programaRepository.findByActivoTrueOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /** Búsqueda con filtros del listado de proyectos. */
    public List<ProgramaResponse> buscar(String q, ProgramaEstado estado, String cliente, String responsable) {
        return programaRepository.buscar(
                        blankToNull(q), estado, blankToNull(cliente), blankToNull(responsable))
                .stream().map(this::toResponse).toList();
    }

    /** Indicadores del detalle del proyecto. */
    public ProgramaResumenResponse resumen(UUID id) {
        buscar(id); // valida existencia
        long total = contar("SELECT COUNT(e) FROM Estudiante e WHERE e.programa.id = :id AND e.activo = true", id);
        long activos = contarPorEstado(id, EstadoAcademico.ACTIVO);
        long graduados = contarPorEstado(id, EstadoAcademico.GRADUADO);
        long retirados = contarPorEstado(id, EstadoAcademico.RETIRADO);
        long enProceso = contarPorEstado(id, EstadoAcademico.EN_PROCESO);
        long incompletos = contar("""
                SELECT COUNT(e) FROM Estudiante e WHERE e.programa.id = :id AND e.activo = true
                AND (e.celular IS NULL OR e.email IS NULL OR e.numeroDocumento IS NULL)""", id);
        long hvs = contar("SELECT COUNT(h) FROM HojaDeVida h WHERE h.estudiante.programa.id = :id AND h.actual = true", id);
        long docs = contar("SELECT COUNT(d) FROM Documento d WHERE d.programa.id = :id AND d.actual = true", id);
        return new ProgramaResumenResponse(total, activos, graduados, retirados, enProceso, incompletos, hvs, docs);
    }

    private long contar(String jpql, UUID id) {
        return entityManager.createQuery(jpql, Long.class).setParameter("id", id).getSingleResult();
    }

    private long contarPorEstado(UUID id, EstadoAcademico estado) {
        return entityManager.createQuery(
                        "SELECT COUNT(e) FROM Estudiante e WHERE e.programa.id = :id AND e.activo = true AND e.estadoAcademico = :estado",
                        Long.class)
                .setParameter("id", id).setParameter("estado", estado).getSingleResult();
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    public ProgramaResponse obtener(UUID id) {
        return toResponse(buscar(id));
    }

    @Transactional
    public ProgramaResponse crear(ProgramaRequest request) {
        var programa = new Programa();
        aplicarRequest(programa, request);
        programa.setEstado(ProgramaEstado.BORRADOR);
        var creado = programaRepository.save(programa);
        auditoriaService.registrar("Proyectos", "Creación", "Programa",
                creado.getId().toString(), creado.getNombre(), null, request.toString());
        return toResponse(creado);
    }

    @Transactional
    public ProgramaResponse actualizar(UUID id, ProgramaRequest request) {
        var programa = buscar(id);
        String anterior = resumenCorto(programa);
        aplicarRequest(programa, request);
        var actualizado = programaRepository.save(programa);
        auditoriaService.registrar("Proyectos", "Actualización", "Programa",
                id.toString(), actualizado.getNombre(), anterior, resumenCorto(actualizado));
        return toResponse(actualizado);
    }

    /** Eliminación con confirmación desde la UI: soft delete (sale de los listados). */
    @Transactional
    public void eliminar(UUID id) {
        var programa = buscar(id);
        programa.setActivo(false);
        programa.setFechaArchivado(LocalDateTime.now());
        programa.setEstado(ProgramaEstado.ARCHIVADO);
        auditoriaService.registrar("Proyectos", "Eliminación", "Programa",
                id.toString(), programa.getNombre(), null, null);
    }

    private static String resumenCorto(Programa p) {
        return "{nombre=%s, cliente=%s, responsable=%s, estado=%s, avance=%d}"
                .formatted(p.getNombre(), p.getCliente(), p.getResponsable(), p.getEstado(), p.getPorcentajeAvance());
    }

    private void aplicarRequest(Programa programa, ProgramaRequest request) {
        programa.setNombre(request.nombre());
        programa.setDescripcion(request.descripcion());
        programa.setDuracionDias(request.duracionDias());
        if (request.fechaInicio() != null && !request.fechaInicio().isBlank())
            programa.setFechaInicio(LocalDate.parse(request.fechaInicio()));
        if (request.fechaFin() != null && !request.fechaFin().isBlank())
            programa.setFechaFin(LocalDate.parse(request.fechaFin()));
        programa.setCliente(request.cliente());
        programa.setResponsable(request.responsable());
        programa.setObservaciones(request.observaciones());
        if (request.porcentajeAvance() != null) programa.setPorcentajeAvance(request.porcentajeAvance());
    }

    @Transactional
    public ProgramaResponse cambiarEstado(UUID id, ProgramaEstado nuevoEstado) {
        var programa = buscar(id);
        if (nuevoEstado == ProgramaEstado.ACTIVO && programa.getEstado() == ProgramaEstado.BORRADOR) {
            programa.setActivo(true);
        }
        if (nuevoEstado == ProgramaEstado.FINALIZADO) {
            programa.setFechaFinalizacion(LocalDateTime.now());
        }
        if (nuevoEstado == ProgramaEstado.ARCHIVADO) {
            programa.setFechaArchivado(LocalDateTime.now());
            programa.setActivo(false);
        }
        String estadoAnterior = programa.getEstado() != null ? programa.getEstado().name() : null;
        programa.setEstado(nuevoEstado);
        var guardado = programaRepository.save(programa);
        auditoriaService.registrar("Proyectos", "Cambio de estado", "Programa",
                id.toString(), guardado.getNombre(), estadoAnterior, nuevoEstado.name());
        return toResponse(guardado);
    }

    private Programa buscar(UUID id) {
        return programaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Programa no encontrado: " + id));
    }

    private ProgramaResponse toResponse(Programa p) {
        return new ProgramaResponse(
                p.getId(), p.getNombre(), p.getDescripcion(), p.getDuracionDias(),
                p.getFechaInicio(), p.getFechaFin(), p.getEstado(), p.isActivo(),
                estudianteRepository.countByProgramaIdAndActivoTrue(p.getId()),
                p.getCliente(), p.getResponsable(), p.getObservaciones(), p.getPorcentajeAvance(),
                p.getCreatedAt()
        );
    }
}
