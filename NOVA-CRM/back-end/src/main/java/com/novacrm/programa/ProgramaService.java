package com.novacrm.programa;

import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.programa.dto.ProgramaRequest;
import com.novacrm.programa.dto.ProgramaResponse;
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

    public ProgramaService(ProgramaRepository programaRepository) {
        this.programaRepository = programaRepository;
    }

    public List<ProgramaResponse> listarActivos() {
        return programaRepository.findByActivoTrueOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public ProgramaResponse obtener(UUID id) {
        return toResponse(buscar(id));
    }

    @Transactional
    public ProgramaResponse crear(ProgramaRequest request) {
        var programa = new Programa();
        programa.setNombre(request.nombre());
        programa.setDescripcion(request.descripcion());
        programa.setDuracionDias(request.duracionDias());
        if (request.fechaInicio() != null) programa.setFechaInicio(LocalDate.parse(request.fechaInicio()));
        if (request.fechaFin() != null) programa.setFechaFin(LocalDate.parse(request.fechaFin()));
        programa.setEstado(ProgramaEstado.BORRADOR);
        return toResponse(programaRepository.save(programa));
    }

    @Transactional
    public ProgramaResponse actualizar(UUID id, ProgramaRequest request) {
        var programa = buscar(id);
        programa.setNombre(request.nombre());
        programa.setDescripcion(request.descripcion());
        programa.setDuracionDias(request.duracionDias());
        if (request.fechaInicio() != null) programa.setFechaInicio(LocalDate.parse(request.fechaInicio()));
        if (request.fechaFin() != null) programa.setFechaFin(LocalDate.parse(request.fechaFin()));
        return toResponse(programaRepository.save(programa));
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
        programa.setEstado(nuevoEstado);
        return toResponse(programaRepository.save(programa));
    }

    private Programa buscar(UUID id) {
        return programaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Programa no encontrado: " + id));
    }

    private ProgramaResponse toResponse(Programa p) {
        return new ProgramaResponse(
                p.getId(), p.getNombre(), p.getDescripcion(), p.getDuracionDias(),
                p.getFechaInicio(), p.getFechaFin(), p.getEstado(), p.isActivo(),
                0, p.getCreatedAt()
        );
    }
}
