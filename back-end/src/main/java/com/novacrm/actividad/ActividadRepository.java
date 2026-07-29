package com.novacrm.actividad;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ActividadRepository extends JpaRepository<Actividad, UUID> {
    List<Actividad> findByProgramaIdOrderByFechaAsc(UUID programaId);
    List<Actividad> findTop10ByEstadoNotAndFechaGreaterThanEqualOrderByFechaAscHoraAsc(
            String estado, LocalDate fecha);
    List<Actividad> findAllByOrderByFechaAscHoraAsc();

    @Query("""
            SELECT a FROM Actividad a
            WHERE a.programa IS NULL OR a.programa.id = :programaId
            ORDER BY a.fecha ASC, a.hora ASC
            """)
    List<Actividad> findVisiblesParaPrograma(@org.springframework.data.repository.query.Param("programaId") UUID programaId);
}
