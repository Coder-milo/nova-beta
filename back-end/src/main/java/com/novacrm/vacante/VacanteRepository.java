package com.novacrm.vacante;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VacanteRepository extends JpaRepository<Vacante, UUID> {

    Page<Vacante> findByActivoTrueOrderByCreatedAtDesc(Pageable pageable);

    Optional<Vacante> findByHashDedup(String hashDedup);

    long countByActivoTrue();

    /**
     * Vacantes que se pueden ofrecer hoy: abiertas y sin vencer.
     *
     * <p>La columna {@code fechaExpiracion} existia desde la primera version y
     * no la leia ninguna consulta, asi que las ofertas caducadas se seguian
     * recomendando y los estudiantes se postulaban a plazas ya cerradas.
     */
    @Query("""
            SELECT v FROM Vacante v
            WHERE v.activo = true
              AND (v.fechaExpiracion IS NULL OR v.fechaExpiracion > :ahora)
            ORDER BY v.createdAt DESC
            """)
    Page<Vacante> findVigentes(@Param("ahora") LocalDateTime ahora, Pageable pageable);

    @Query("""
            SELECT COUNT(v) FROM Vacante v
            WHERE v.activo = true
              AND (v.fechaExpiracion IS NULL OR v.fechaExpiracion > :ahora)
            """)
    long contarVigentes(@Param("ahora") LocalDateTime ahora);

    /** Abiertas cuya fecha ya paso: candidatas a cerrarse automaticamente. */
    @Query("""
            SELECT v FROM Vacante v
            WHERE v.activo = true
              AND v.fechaExpiracion IS NOT NULL
              AND v.fechaExpiracion <= :ahora
            """)
    List<Vacante> findVencidasSinCerrar(@Param("ahora") LocalDateTime ahora);

    /** Cuantas vacantes entraron desde un momento dado. */
    long countByCreatedAtAfter(Instant desde);

    /** Evita registrar dos veces la misma oferta pegada a mano. */
    Optional<Vacante> findByUrlOrigen(String urlOrigen);

    /** Vacantes abiertas de una empresa. Para la ficha del CRM. */
    long countByEmpresaIdAndActivoTrue(UUID empresaId);

    /**
     * Vigentes y validadas: las unicas que entran al matching.
     *
     * <p>Una oferta sin revisar se ve en el listado, pero recomendarsela a los
     * 107 participantes es otra cosa. Es el filtro que impide que una oferta
     * falsa registrada por alguien llegue sola a toda la cohorte.
     */
    @Query("""
            SELECT v FROM Vacante v
            WHERE v.activo = true
              AND v.revisada = true
              AND (v.fechaExpiracion IS NULL OR v.fechaExpiracion > :ahora)
            ORDER BY v.createdAt DESC
            """)
    List<Vacante> findVigentesRevisadas(@Param("ahora") LocalDateTime ahora);
}
