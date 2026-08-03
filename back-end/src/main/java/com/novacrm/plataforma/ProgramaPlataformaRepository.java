package com.novacrm.plataforma;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ProgramaPlataformaRepository extends JpaRepository<ProgramaPlataforma, UUID> {
    List<ProgramaPlataforma> findByProgramaId(UUID programaId);

    @Query("""
            SELECT pp.plataformaId FROM ProgramaPlataforma pp
            WHERE pp.programaId = :programaId
            """)
    List<UUID> findPlataformaIdsByProgramaId(@Param("programaId") UUID programaId);
}