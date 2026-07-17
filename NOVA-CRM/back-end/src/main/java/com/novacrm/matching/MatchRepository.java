package com.novacrm.matching;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MatchRepository extends JpaRepository<Match, UUID> {
    Page<Match> findByEstudianteIdOrderByPuntajeDesc(UUID estudianteId, Pageable pageable);
    List<Match> findByEstudianteIdAndNotificadoFalse(UUID estudianteId);
    long countByEstudianteIdAndNotificadoFalse(UUID estudianteId);
    boolean existsByEstudianteIdAndVacanteId(UUID estudianteId, UUID vacanteId);
}
