package com.novacrm.perfil;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExperienciaLaboralRepository extends JpaRepository<ExperienciaLaboral, UUID> {
    List<ExperienciaLaboral> findByEstudianteIdOrderByFechaInicioDesc(UUID estudianteId);
}
