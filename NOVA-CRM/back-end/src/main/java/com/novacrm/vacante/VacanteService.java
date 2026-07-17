package com.novacrm.vacante;

import com.novacrm.vacante.dto.VacanteResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class VacanteService {

    private final VacanteRepository vacanteRepository;

    public VacanteService(VacanteRepository vacanteRepository) {
        this.vacanteRepository = vacanteRepository;
    }

    public Page<VacanteResponse> listarActivas(Pageable pageable) {
        return vacanteRepository.findByActivoTrueOrderByCreatedAtDesc(pageable)
                .map(this::toResponse);
    }

    public VacanteResponse obtener(UUID id) {
        var vacante = vacanteRepository.findById(id).orElseThrow(
                () -> new com.novacrm.exception.ResourceNotFoundException("Vacante no encontrada: " + id));
        return toResponse(vacante);
    }

    private VacanteResponse toResponse(Vacante v) {
        return new VacanteResponse(
                v.getId(), v.getTitulo(), v.getDescripcion(), v.getRequisitos(),
                v.getUbicacion(), v.getRangoSalarial(), v.getTipoContrato(), v.getModalidadTrabajo(),
                v.getNivelInglesRequerido(), v.getAniosExperienciaRequeridos(), v.getFuente(),
                v.getUrlOrigen(), v.getUrlAplicar(),
                v.getEmpresa() != null ? v.getEmpresa().getNombre() : null,
                v.getFechaPublicacion(), v.getCreatedAt());
    }

    @Transactional
    public Vacante crear(Vacante vacante) {
        return vacanteRepository.save(vacante);
    }

    public long contarActivas() {
        return vacanteRepository.countByActivoTrue();
    }
}
