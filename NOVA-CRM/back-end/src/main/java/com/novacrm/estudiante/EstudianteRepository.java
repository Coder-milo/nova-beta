package com.novacrm.estudiante;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EstudianteRepository extends JpaRepository<Estudiante, UUID> {
    Page<Estudiante> findByProgramaIdAndActivoTrue(UUID programaId, Pageable pageable);
    Optional<Estudiante> findByEmail(String email);
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
              and (e.celular is null or e.email is null or e.numeroDocumento is null)
            """)
    long contarActivosConDatosFaltantes();

    interface ConteoPorProgramaProjection {
        UUID getProgramaId();
        String getNombre();
        long getTotal();
    }

    interface SerieMensualProjection {
        String getMes();
        long getTotal();
    }
}
