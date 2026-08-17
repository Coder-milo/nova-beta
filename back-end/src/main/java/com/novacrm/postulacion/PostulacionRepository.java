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

    @Query("SELECT p.estado, COUNT(p) FROM Postulacion p GROUP BY p.estado")
    List<Object[]> recuentoPorEstado();

    /**
     * Las postulaciones vivas, para el tablero.
     *
     * <p>Deja fuera las finales —contratado, rechazado, sin respuesta—. Un
     * tablero es una cola de trabajo: lo cerrado no se arrastra a ningún sitio y
     * lo único que hace es alargar columnas que nadie mira. El historial
     * completo vive en la línea de tiempo de cada estudiante.
     *
     * <p>Con filtro opcional por proyecto: el tablero de una cohorte de cien
     * personas es inservible si trae las cuatro cohortes a la vez.
     */
    @Query("""
            SELECT p FROM Postulacion p
            JOIN FETCH p.estudiante e
            WHERE p.estado NOT IN (
                com.novacrm.postulacion.EstadoPostulacion.CONTRATADO,
                com.novacrm.postulacion.EstadoPostulacion.RECHAZADO,
                com.novacrm.postulacion.EstadoPostulacion.SIN_RESPUESTA)
              AND (:programaId IS NULL OR e.programa.id = :programaId)
            ORDER BY p.fechaPostulacion DESC
            """)
    List<Postulacion> paraTablero(@Param("programaId") UUID programaId);

    /** Quienes se postularon a una vacante. Para el portal de empresas. */
    @Query("""
            SELECT p FROM Postulacion p
            JOIN FETCH p.estudiante e
            LEFT JOIN FETCH e.programa
            LEFT JOIN FETCH e.nivelIngles
            WHERE p.vacante.id = :vacanteId
            ORDER BY p.fechaPostulacion DESC
            """)
    List<Postulacion> findByVacanteIdOrderByFechaPostulacionDesc(@Param("vacanteId") UUID vacanteId);

    /**
     * Todas las candidaturas que alcanza una empresa.
     *
     * <p>Son las de sus vacantes mas las registradas a mano contra su ficha. El
     * nombre de empresa en texto libre queda fuera a proposito: lo escribe
     * cualquiera al registrar una postulacion, y si contara como pertenencia
     * bastaria teclear el nombre de otra para ver a sus candidatos.
     *
     * <p>Los {@code JOIN FETCH} traen programa y nivel de ingles de una vez: el
     * listado los pinta en cada fila, y sin ellos son dos consultas por
     * candidato.
     */
    @Query("""
            SELECT p FROM Postulacion p
            JOIN FETCH p.estudiante e
            LEFT JOIN FETCH e.programa
            LEFT JOIN FETCH e.nivelIngles
            LEFT JOIN p.vacante v
            WHERE v.empresa.id = :empresaId OR p.empresa.id = :empresaId
            ORDER BY p.fechaPostulacion DESC
            """)
    List<Postulacion> findParaEmpresa(@Param("empresaId") UUID empresaId);

    /**
     * Las citas de un tramo de fechas, en orden de reloj.
     *
     * <p>{@code JOIN FETCH} sobre el estudiante porque la agenda pinta su
     * nombre en cada fila: sin el, una semana con treinta citas son treinta
     * consultas extra, una por nombre.
     */
    @Query("""
            SELECT p FROM Postulacion p
            JOIN FETCH p.estudiante
            WHERE p.fechaHoraEntrevista >= :desde
              AND p.fechaHoraEntrevista < :hasta
            ORDER BY p.fechaHoraEntrevista ASC
            """)
    List<Postulacion> agendaEntre(@Param("desde") java.time.LocalDateTime desde,
                                  @Param("hasta") java.time.LocalDateTime hasta);

    /**
     * Citas cuya hora ya paso y siguen figurando como agendadas.
     *
     * <p>Es la cola que de verdad importa de una agenda: o la entrevista se hizo
     * y nadie anoto el resultado, o la persona no se presento. En los dos casos
     * hay algo que hacer, y sin esta consulta se quedan enterradas en el pasado
     * del calendario, donde nadie vuelve a mirar.
     */
    @Query("""
            SELECT p FROM Postulacion p
            JOIN FETCH p.estudiante
            WHERE p.fechaHoraEntrevista < :ahora
              AND p.estado = com.novacrm.postulacion.EstadoPostulacion.ENTREVISTA_AGENDADA
            ORDER BY p.fechaHoraEntrevista DESC
            """)
    List<Postulacion> entrevistasSinCerrar(@Param("ahora") java.time.LocalDateTime ahora);

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
