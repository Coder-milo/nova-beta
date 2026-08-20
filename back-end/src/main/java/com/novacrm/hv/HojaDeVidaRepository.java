package com.novacrm.hv;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HojaDeVidaRepository extends JpaRepository<HojaDeVida, UUID> {
    /** Historial ordenado para consultas de solo lectura. */
    List<HojaDeVida> findByEstudianteIdOrderByNumeroVersionDesc(UUID estudianteId);

    /**
     * Variante bloqueante, exclusiva de los flujos que crean o cambian la
     * version vigente. La consulta normal no puede llevar este lock: también
     * se usa para mostrar el historial dentro de una transacción de solo
     * lectura y PostgreSQL rechaza un FOR UPDATE en ese contexto. El lock
     * serializa el cálculo read-then-insert por estudiante; el unique parcial
     * de V24 sigue siendo la red de seguridad.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT h FROM HojaDeVida h WHERE h.estudiante.id = :estudianteId ORDER BY h.numeroVersion DESC")
    List<HojaDeVida> findVersionesForUpdate(@Param("estudianteId") UUID estudianteId);
    Optional<HojaDeVida> findFirstByEstudianteIdAndActualTrue(UUID estudianteId);
    long countByActualTrue();

    /** Indica si el estudiante ya tiene una hoja de vida vigente generada. */
    boolean existsByEstudianteIdAndActualTrue(UUID estudianteId);
}
