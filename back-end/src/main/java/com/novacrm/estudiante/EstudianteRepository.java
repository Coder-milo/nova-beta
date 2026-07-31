package com.novacrm.estudiante;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EstudianteRepository extends JpaRepository<Estudiante, UUID> {
    Page<Estudiante> findByProgramaIdAndActivoTrue(UUID programaId, Pageable pageable);

    List<Estudiante> findAllByProgramaIdAndActivoTrue(UUID programaId);
    Optional<Estudiante> findByEmail(String email);
    Optional<Estudiante> findByNumeroDocumento(String numeroDocumento);
    long countByProgramaIdAndActivoTrue(UUID programaId);

    // --- Dashboard: KPIs y variaciones temporales ---
    long countByCreatedAtGreaterThanEqual(Instant desde);
    long countByCreatedAtBetween(Instant desde, Instant hasta);
    long countByEstadoAcademico(EstadoAcademico estado);
    long countByEstadoAcademicoAndCreatedAtLessThan(EstadoAcademico estado, Instant hasta);
    long countByEstadoEmpleabilidad(EstadoEmpleabilidad estado);

    // --- Dashboard: graficos ---
    @Query("""
            select e.programa.id as programaId, e.programa.nombre as nombre, count(e) as total
            from Estudiante e
            where e.activo = true
            group by e.programa.id, e.programa.nombre
            order by total desc
            """)
    List<ConteoPorProgramaProjection> contarActivosPorPrograma();

    @Query(value = """
            select to_char(date_trunc('month', created_at), 'YYYY-MM') as mes, count(*) as total
            from estudiante
            where date_part('year', created_at) = date_part('year', CURRENT_DATE)
            group by date_trunc('month', created_at)
            order by mes
            """, nativeQuery = true)
    List<SerieMensualProjection> contarIngresosPorMesAnioActual();

    // --- Dashboard: alertas (estudiantes activos con datos clave faltantes) ---
    @Query("""
            select count(e) from Estudiante e
            where e.activo = true
              and (e.celular is null or trim(e.celular) = ''
                   or e.email is null or trim(e.email) = ''
                   or e.numeroDocumento is null or trim(e.numeroDocumento) = '')
            """)
    long contarActivosConDatosFaltantes();

    @Query("""
            select e from Estudiante e
            where e.activo = true
              and (e.celular is null or trim(e.celular) = ''
                   or e.email is null or trim(e.email) = ''
                   or e.numeroDocumento is null or trim(e.numeroDocumento) = '')
            """)
    Page<Estudiante> buscarActivosConDatosFaltantes(Pageable pageable);

    // --- Papelera ---
    Page<Estudiante> findByProgramaIdAndActivoFalse(UUID programaId, Pageable pageable);
    long countByProgramaIdAndActivoFalse(UUID programaId);
    long countByActivoFalse();
    List<Estudiante> findByActivoFalseAndDeletedAtBefore(Instant fecha);

    @Modifying
    @Query("UPDATE Estudiante e SET e.activo = false, e.deletedAt = CURRENT_TIMESTAMP WHERE e.programa.id = :programaId AND e.activo = true")
    int softDeleteByProgramaId(@Param("programaId") UUID programaId);

    /** Al borrar una plantilla: nadie queda apuntando a ella como preferida. */
    @Modifying
    @Query("UPDATE Estudiante e SET e.plantillaPreferida = null WHERE e.plantillaPreferida.id = :plantillaId")
    int desvincularPlantillaPreferida(@Param("plantillaId") UUID plantillaId);

    interface ConteoPorProgramaProjection {
        UUID getProgramaId();
        String getNombre();
        long getTotal();
    }

    interface SerieMensualProjection {
        String getMes();
        long getTotal();
    }

    @org.springframework.data.jpa.repository.Query("""
            SELECT e FROM Estudiante e
            WHERE e.activo = true
              AND (:q IS NULL OR LOWER(e.nombre) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                   OR LOWER(e.apellido) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                   OR LOWER(e.email) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                   OR e.numeroDocumento LIKE CONCAT('%', CAST(:q AS string), '%'))
              AND (:programaId IS NULL OR e.programa.id = :programaId)
              AND (:ciudad IS NULL OR LOWER(e.ciudad) = LOWER(CAST(:ciudad AS string)))
              AND (:estadoAcademico IS NULL OR e.estadoAcademico = :estadoAcademico)
              AND (:estadoEmpleabilidad IS NULL OR e.estadoEmpleabilidad = :estadoEmpleabilidad)
            """)
    Page<Estudiante> buscarAvanzado(@org.springframework.data.repository.query.Param("q") String q,
                                    @org.springframework.data.repository.query.Param("programaId") UUID programaId,
                                    @org.springframework.data.repository.query.Param("ciudad") String ciudad,
                                    @org.springframework.data.repository.query.Param("estadoAcademico") EstadoAcademico estadoAcademico,
                                    @org.springframework.data.repository.query.Param("estadoEmpleabilidad") EstadoEmpleabilidad estadoEmpleabilidad,
                                    Pageable pageable);

    // --- Insumos para la busqueda de vacantes -------------------------------
    // Los terminos con los que se rastrean los portales salen de lo que los
    // propios estudiantes declararon querer, no de una lista fija.

    @org.springframework.data.jpa.repository.Query("""
            SELECT DISTINCT e.cargoObjetivo FROM Estudiante e
            WHERE e.activo = true AND e.cargoObjetivo IS NOT NULL AND e.cargoObjetivo <> ''
            """)
    java.util.List<String> findCargosObjetivoDeActivos();

    @org.springframework.data.jpa.repository.Query("""
            SELECT DISTINCT e.sectorObjetivo FROM Estudiante e
            WHERE e.activo = true AND e.sectorObjetivo IS NOT NULL AND e.sectorObjetivo <> ''
            """)
    java.util.List<String> findSectoresObjetivoDeActivos();

    @org.springframework.data.jpa.repository.Query("""
            SELECT e.ciudad FROM Estudiante e
            WHERE e.activo = true AND e.ciudad IS NOT NULL AND e.ciudad <> ''
            GROUP BY e.ciudad
            ORDER BY COUNT(e) DESC
            """)
    java.util.List<String> findCiudadesDeActivosPorFrecuencia();

    /** Destinatarios de un anuncio general. */
    List<Estudiante> findAllByActivoTrue();
}
