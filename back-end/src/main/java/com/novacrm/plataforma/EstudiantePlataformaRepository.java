package com.novacrm.plataforma;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface EstudiantePlataformaRepository extends JpaRepository<EstudiantePlataforma, UUID> {
    List<EstudiantePlataforma> findByEstudianteId(UUID estudianteId);

    @Query("""
            SELECT ep.plataformaId FROM EstudiantePlataforma ep
            WHERE ep.estudianteId = :estudianteId
            """)
    List<UUID> findPlataformaIdsByEstudianteId(@Param("estudianteId") UUID estudianteId);
}