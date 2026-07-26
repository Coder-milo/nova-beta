package com.novacrm.actividad;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ActividadRepository extends JpaRepository<Actividad, UUID> {
    List<Actividad> findByProgramaIdOrderByFechaAsc(UUID programaId);
    List<Actividad> findTop10ByEstadoNotAndFechaGreaterThanEqualOrderByFechaAscHoraAsc(
            String estado, LocalDate fecha);
    List<Actividad> findAllByOrderByFechaAscHoraAsc();
}
