package com.novacrm.certificacion;

import com.novacrm.certificacion.dto.CertificacionResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class CertificacionService {

    private final CertificacionRepository certificacionRepository;

    public CertificacionService(CertificacionRepository certificacionRepository) {
        this.certificacionRepository = certificacionRepository;
    }

    public List<CertificacionResponse> listarPorPrograma(UUID programaId) {
        return certificacionRepository.findByProgramaId(programaId).stream()
                .map(this::toResponse)
                .toList();
    }

    public CertificacionResponse obtener(UUID id) {
        var certificacion = certificacionRepository.findById(id).orElseThrow(
                () -> new com.novacrm.exception.ResourceNotFoundException("Certificacion no encontrada: " + id));
        return toResponse(certificacion);
    }

    private CertificacionResponse toResponse(Certificacion c) {
        return new CertificacionResponse(
                c.getId(), c.getNombre(), c.getDescripcion(), c.getHorasCurriculares(),
                c.getHabilidadesCubiertas(), c.getTextoCompartir(),
                c.getPrograma() != null ? c.getPrograma().getId() : null,
                c.getPrograma() != null ? c.getPrograma().getNombre() : null,
                c.isActivo());
    }
}
