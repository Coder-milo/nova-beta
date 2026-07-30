package com.novacrm.hv;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HojaDeVidaRepository extends JpaRepository<HojaDeVida, UUID> {
    List<HojaDeVida> findByEstudianteIdOrderByNumeroVersionDesc(UUID estudianteId);
    Optional<HojaDeVida> findFirstByEstudianteIdAndActualTrue(UUID estudianteId);
    long countByActualTrue();

    /** Indica si el estudiante ya tiene una hoja de vida vigente generada. */
    boolean existsByEstudianteIdAndActualTrue(UUID estudianteId);
}
