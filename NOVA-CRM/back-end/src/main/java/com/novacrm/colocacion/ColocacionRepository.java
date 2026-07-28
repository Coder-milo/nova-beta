package com.novacrm.colocacion;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ColocacionRepository extends JpaRepository<Colocacion, UUID> {

    List<Colocacion> findByEstudianteIdOrderByFechaInicioDesc(UUID estudianteId);

    Optional<Colocacion> findFirstByEstudianteIdAndActivaTrueOrderByFechaInicioDesc(UUID estudianteId);

    boolean existsByEstudianteIdAndActivaTrue(UUID estudianteId);

    long countByActivaTrue();

    @Query("SELECT c FROM Colocacion c WHERE c.activa = true ORDER BY c.fechaInicio DESC NULLS LAST")
    List<Colocacion> vigentes();

    /** Ids de quienes tienen colocacion vigente. Para no consultar uno a uno. */
    @Query("SELECT c.estudiante.id FROM Colocacion c WHERE c.activa = true")
    List<UUID> idsColocados();

    /**
     * Colocados en esta empresa.
     *
     * <p>Por ficha o por nombre, igual que en postulaciones: una colocacion
     * registrada antes de dar de alta la empresa se queda sin
     * {@code empresa_id} y no volveria a contarse nunca.
     */
    @Query("""
            SELECT COUNT(c) FROM Colocacion c
            WHERE c.activa = true
              AND (c.empresa.id = :empresaId
                   OR LOWER(TRIM(c.empresaNombre)) = LOWER(TRIM(:nombre)))
            """)
    long contarColocadosEn(@Param("empresaId") UUID empresaId, @Param("nombre") String nombre);

    @Query("""
            SELECT COUNT(c) FROM Colocacion c
            WHERE c.activa = true AND c.salario IS NOT NULL AND c.salario >= :meta
            """)
    long contarSobreMeta(@Param("meta") java.math.BigDecimal meta);

    @Query("SELECT AVG(c.salario) FROM Colocacion c WHERE c.activa = true AND c.salario IS NOT NULL")
    java.math.BigDecimal salarioPromedio();

    @Query("SELECT c.canalConsecucion, COUNT(c) FROM Colocacion c WHERE c.activa = true GROUP BY c.canalConsecucion")
    List<Object[]> recuentoPorCanal();

    /** Igual que en postulaciones: engancha lo registrado antes que la ficha. */
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("""
            UPDATE Colocacion c SET c.empresa = :empresa
            WHERE c.empresa IS NULL
              AND LOWER(TRIM(c.empresaNombre)) = LOWER(TRIM(:nombre))
            """)
    int vincularPorNombre(@Param("empresa") com.novacrm.empresa.Empresa empresa,
                          @Param("nombre") String nombre);
}
