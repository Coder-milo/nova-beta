package com.novacrm.programa;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ProgramaRepository extends JpaRepository<Programa, UUID> {
    List<Programa> findByActivoTrueOrderByCreatedAtDesc();
    List<Programa> findByEstadoOrderByCreatedAtDesc(ProgramaEstado estado);
    long countByActivoTrue();
    List<Programa> findByEstadoAndFechaFinBetween(ProgramaEstado estado, LocalDate desde, LocalDate hasta);

    @Query("""
            SELECT p FROM Programa p
            WHERE p.activo = true
              AND (:q IS NULL OR LOWER(p.nombre) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
              AND (:estado IS NULL OR p.estado = :estado)
              AND (:cliente IS NULL OR LOWER(p.cliente) LIKE LOWER(CONCAT('%', CAST(:cliente AS string), '%')))
              AND (:responsable IS NULL OR LOWER(p.responsable) LIKE LOWER(CONCAT('%', CAST(:responsable AS string), '%')))
            ORDER BY p.createdAt DESC
            """)
    List<Programa> buscar(@Param("q") String q,
                          @Param("estado") ProgramaEstado estado,
                          @Param("cliente") String cliente,
                          @Param("responsable") String responsable);
}
