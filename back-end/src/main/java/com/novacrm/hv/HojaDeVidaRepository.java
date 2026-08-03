package com.novacrm.hv;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HojaDeVidaRepository extends JpaRepository<HojaDeVida, UUID> {
    /**
     * PESSIMISTIC_WRITE: el numero de version se calcula con read-then-insert
     * y dos generaciones concurrentes leian la misma version y quedaban dos
     * vigentes. El lock serializa por estudiante; el unique parcial de V24 es
     * la red de seguridad si algun dia aparece otro camino de escritura.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<HojaDeVida> findByEstudianteIdOrderByNumeroVersionDesc(UUID estudianteId);
    Optional<HojaDeVida> findFirstByEstudianteIdAndActualTrue(UUID estudianteId);
    long countByActualTrue();

    /** Indica si el estudiante ya tiene una hoja de vida vigente generada. */
    boolean existsByEstudianteIdAndActualTrue(UUID estudianteId);
}
