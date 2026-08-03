package com.novacrm.matching;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MatchRepository extends JpaRepository<Match, UUID> {
    Page<Match> findByEstudianteIdOrderByPuntajeDesc(UUID estudianteId, Pageable pageable);

    /**
     * Recomendaciones vivas del estudiante.
     *
     * <p>Se filtra la vigencia de la vacante —la consulta anterior no lo hacia
     * y la lista acumulaba plazas ya cerradas indefinidamente— y se dejan fuera
     * las que la persona descarto, que se conservan para calibrar el motor pero
     * no se le vuelven a mostrar.
     */
    @Query("""
            SELECT m FROM Match m
            JOIN m.vacante v
            WHERE m.estudiante.id = :estudianteId
              AND m.descartado = false
              AND v.activo = true
              AND (v.fechaExpiracion IS NULL OR v.fechaExpiracion > :ahora)
            ORDER BY m.puntaje DESC
            """)
    Page<Match> findVigentesDeEstudiante(@Param("estudianteId") UUID estudianteId,
                                         @Param("ahora") java.time.LocalDateTime ahora,
                                         Pageable pageable);
    List<Match> findByEstudianteIdAndNotificadoFalse(UUID estudianteId);
    long countByEstudianteIdAndNotificadoFalse(UUID estudianteId);
    boolean existsByEstudianteIdAndVacanteId(UUID estudianteId, UUID vacanteId);

    /**
     * Pares estudiante×vacante ya emparejados para un lote de vacantes, en una
     * sola consulta. Evita el existsBy... por par que hacia N+1 en el matching
     * (BE-05); solo se leen los IDs de las asociaciones lazy, sin cargar
     * Estudiante/Vacante completos.
     */
    List<Match> findByVacanteIdIn(Collection<UUID> vacanteIds);

    /**
     * El match sin postular más reciente del estudiante. Es el que responde el
     * estudiante cuando escribe "sí me interesa" en lugar de usar los botones
     * de la plantilla, que traen el id exacto.
     */
    Optional<Match> findFirstByEstudianteIdAndPostuladoFalseOrderByCreatedAtDesc(UUID estudianteId);

    /** Postulaciones efectivamente enviadas por el estudiante. */
    long countByEstudianteIdAndPostuladoTrue(UUID estudianteId);

    /**
     * Empresas distintas alcanzadas por las postulaciones del estudiante. Se
     * cuenta la empresa, no la vacante: varias vacantes de una misma empresa
     * son un unico contacto.
     */
    @Query("""
            SELECT COUNT(DISTINCT m.vacante.empresa.id)
            FROM Match m
            WHERE m.estudiante.id = :estudianteId
              AND m.postulado = true
              AND m.vacante.empresa IS NOT NULL
            """)
    long contarEmpresasContactadas(@Param("estudianteId") UUID estudianteId);
}
