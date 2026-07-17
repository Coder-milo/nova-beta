package com.novacrm.programa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ProgramaRepository extends JpaRepository<Programa, UUID> {
    List<Programa> findByActivoTrueOrderByCreatedAtDesc();
    List<Programa> findByEstadoOrderByCreatedAtDesc(ProgramaEstado estado);
    long countByActivoTrue();
    List<Programa> findByEstadoAndFechaFinBetween(ProgramaEstado estado, LocalDate desde, LocalDate hasta);
}
