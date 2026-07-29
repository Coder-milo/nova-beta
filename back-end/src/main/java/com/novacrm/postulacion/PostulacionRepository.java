package com.novacrm.postulacion;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PostulacionRepository extends JpaRepository<Postulacion, UUID> {

    List<Postulacion> findByEstudianteIdOrderByFechaPostulacionDesc(UUID estudianteId);

    Page<Postulacion> findByEstudianteId(UUID estudianteId, Pageable pageable);

    Optional<Postulacion> findByEstudianteIdAndVacanteId(UUID estudianteId, UUID vacanteId);

    long countByEstudianteId(UUID estudianteId);

    long countByEstudianteIdAndEstado(UUID estudianteId, EstadoPostulacion estado);

    List<Postulacion> findByEmpresaId(UUID empresaId);

    /**
     * Cuantos participantes distintos se han presentado a esta empresa.
     *
     * <p>La hoja guardaba este numero como columna y decia "104" en todas las
     * filas porque nadie lo actualizaba nunca. Se cuenta.
     *
     * <p>Se busca por ficha <strong>y</strong> por nombre. Una postulacion
     * anotada antes de que la empresa existiera en el directorio se queda sin
     * {@code empresa_id} para siempre, y contar solo por ficha dejaria el
     * contador en cero justo en las empresas con las que mas se ha trabajado
     * —que son las que se dieron de alta tarde, cuando la relacion ya iba en
     * serio—.
     */
    @Query("""
            SELECT COUNT(DISTINCT p.estudiante.id) FROM Postulacion p
            WHERE p.empresa.id = :empresaId
               OR LOWER(TRIM(p.empresaNombre)) = LOWER(TRIM(:nombre))
            """)
    long contarParticipantesDe(@Param("empresaId") UUID empresaId, @Param("nombre") String nombre);

    @Query("""
            SELECT COUNT(p) FROM Postulacion p
            WHERE (p.empresa.id = :empresaId
                   OR LOWER(TRIM(p.empresaNombre)) = LOWER(TRIM(:nombre)))
              AND p.fechaRespuesta IS NOT NULL
            """)
    long contarRespuestasDe(@Param("empresaId") UUID empresaId, @Param("nombre") String nombre);

    /** Postulaciones que el estudiante dice haber ganado y el equipo no ha confirmado. */
    @Query("""
            SELECT p FROM Postulacion p
            WHERE p.estado = com.novacrm.postulacion.EstadoPostulacion.CONTRATADO
              AND NOT EXISTS (
                  SELECT 1 FROM Colocacion c
                  WHERE c.estudiante.id = p.estudiante.id AND c.activa = true)
            ORDER BY p.updatedAt DESC
            """)
    List<Postulacion> contratadasSinColocacion();

    @Query("SELECT p.estado, COUNT(p) FROM Postulacion p GROUP BY p.estado")
    List<Object[]> recuentoPorEstado();

    /**
     * Engancha a su ficha las postulaciones que se anotaron antes de que la
     * empresa existiera en el directorio.
     *
     * <p>Sin esto la clave foranea se queda nula para siempre y cualquier
     * consulta futura por {@code empresa_id} —no solo los contadores— deja
     * fuera precisamente a las empresas con las que mas se ha trabajado.
     */
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @Query("""
            UPDATE Postulacion p SET p.empresa = :empresa
            WHERE p.empresa IS NULL
              AND LOWER(TRIM(p.empresaNombre)) = LOWER(TRIM(:nombre))
            """)
    int vincularPorNombre(@Param("empresa") com.novacrm.empresa.Empresa empresa,
                          @Param("nombre") String nombre);
}
