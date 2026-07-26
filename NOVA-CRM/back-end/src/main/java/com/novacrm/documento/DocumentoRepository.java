package com.novacrm.documento;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface DocumentoRepository extends JpaRepository<Documento, UUID> {

    @Query("""
            SELECT d FROM Documento d
            WHERE d.actual = true
              AND (:estudianteId IS NULL OR d.estudiante.id = :estudianteId)
              AND (:programaId IS NULL OR d.programa.id = :programaId)
              AND (:tipo IS NULL OR d.tipo = :tipo)
              AND (:q IS NULL OR LOWER(d.nombre) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            """)
    Page<Documento> buscar(@Param("estudianteId") UUID estudianteId,
                           @Param("programaId") UUID programaId,
                           @Param("tipo") String tipo,
                           @Param("q") String q,
                           Pageable pageable);

    List<Documento> findByGrupoIdOrderByNumeroVersionDesc(UUID grupoId);

    long countByEstudianteIdAndActualTrue(UUID estudianteId);

    long countByActualTrue();
}
