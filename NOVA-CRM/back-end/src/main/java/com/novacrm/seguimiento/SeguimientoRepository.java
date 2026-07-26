package com.novacrm.seguimiento;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SeguimientoRepository extends JpaRepository<Seguimiento, UUID> {
    List<Seguimiento> findByEstudianteIdOrderByFechaDesc(UUID estudianteId);
}
