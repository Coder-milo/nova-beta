package com.novacrm.habilidad;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface EstudianteHabilidadRepository extends JpaRepository<EstudianteHabilidad, UUID> {
    List<EstudianteHabilidad> findByEstudianteId(UUID estudianteId);
    List<EstudianteHabilidad> findByEstudianteIdIn(Collection<UUID> estudianteIds);
}
