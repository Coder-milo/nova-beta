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

    /** Una fila por estudiante que tenga al menos una postulacion enviada. */
    interface PostuladosPorEstudiante {
        UUID getEstudianteId();
        long getTotal();
    }

    /**
     * Lo mismo para varios de una vez.
     *
     * <p>El tablero lo pedia estudiante por estudiante. Solo aparecen quienes
     * tienen alguna, asi que quien lo use debe tratar la ausencia como cero:
     * un {@code group by} no devuelve fila para quien no tiene ninguna.
     */
    @Query("""
            select m.estudiante.id as estudianteId, count(m) as total
            from Match m
            where m.postulado = true and m.estudiante.id in :estudianteIds
            group by m.estudiante.id
            """)
    List<PostuladosPorEstudiante> contarPostuladosDeVarios(
            @Param("estudianteIds") java.util.Collection<UUID> estudianteIds);

    interface EmpresasContactadasPorEstudiante {
        UUID getEstudianteId();
        long getTotal();
    }

    /** Empresas distintas alcanzadas, agrupadas para construir tableros. */
    @Query("""
            SELECT m.estudiante.id AS estudianteId,
                   COUNT(DISTINCT m.vacante.empresa.id) AS total
            FROM Match m
            WHERE m.postulado = true
              AND m.estudiante.id IN :estudianteIds
              AND m.vacante.empresa IS NOT NULL
            GROUP BY m.estudiante.id
            """)
    List<EmpresasContactadasPorEstudiante> contarEmpresasContactadasDeVarios(
            @Param("estudianteIds") java.util.Collection<UUID> estudianteIds);

    interface OportunidadesPorEstudiante {
        UUID getEstudianteId();
        long getTotal();
        java.math.BigDecimal getMejorPuntaje();
    }

    /**
     * Oportunidades todavía accionables, agregadas por estudiante.
     *
     * <p>No devuelve cada match: el Centro de Acción solo necesita saber si
     * existen opciones y cuál es la mejor compatibilidad.
     */
    @Query("""
            SELECT m.estudiante.id AS estudianteId,
                   COUNT(m) AS total,
                   MAX(m.puntaje) AS mejorPuntaje
            FROM Match m JOIN m.vacante v
            WHERE m.estudiante.id IN :ids
              AND m.postulado = false
              AND m.descartado = false
              AND v.activo = true
              AND (v.fechaExpiracion IS NULL OR v.fechaExpiracion > :ahora)
            GROUP BY m.estudiante.id
            """)
    List<OportunidadesPorEstudiante> resumirOportunidadesVigentes(
            @Param("ids") java.util.Collection<UUID> ids,
            @Param("ahora") java.time.LocalDateTime ahora);

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
