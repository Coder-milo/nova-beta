package com.novacrm.estudiante;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EstudianteRepository extends JpaRepository<Estudiante, UUID> {
    // programa es LAZY; sin el fetch, toResponse() dispara una consulta extra
    // por Programa distinto en la pagina al leer e.getPrograma() (BE-13).
    @EntityGraph(attributePaths = "programa")
    Page<Estudiante> findByProgramaIdAndActivoTrue(UUID programaId, Pageable pageable);

    List<Estudiante> findAllByProgramaIdAndActivoTrue(UUID programaId);
    Optional<Estudiante> findByEmail(String email);
    Optional<Estudiante> findByNumeroDocumento(String numeroDocumento);

    /**
     * El estudiante activo cuyo celular coincide con los dígitos dados,
     * ignorando espacios, guiones, puntos y el indicativo que falte o sobre.
     * Los celulares de la base se cargaron a mano y en varios formatos, y el
     * remitente llega de Meta siempre en E.164: dos "mismos" números pueden
     * ser "57 300 123 4567" y "+573001234567".
     *
     * <p>Busca por dígitos exactos primero y por versión sin el 57 inicial
     * después (ver {@link com.novacrm.whatsapp.WhatsappWebhookService}).
     */
    @Query(value = """
            SELECT * FROM estudiante e
            WHERE e.activo = true
              AND e.celular IS NOT NULL
              AND regexp_replace(e.celular, '\\D', '', 'g') = :digitos
            LIMIT 1
            """, nativeQuery = true)
    Optional<Estudiante> findByCelularLimpio(@Param("digitos") String digitos);
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
    @EntityGraph(attributePaths = "programa")
    Page<Estudiante> buscarActivosConDatosFaltantes(Pageable pageable);

    // --- Papelera ---
    @EntityGraph(attributePaths = "programa")
    Page<Estudiante> findByProgramaIdAndActivoFalse(UUID programaId, Pageable pageable);
    long countByProgramaIdAndActivoFalse(UUID programaId);
    long countByActivoFalse();

    @Modifying
    @Query("UPDATE Estudiante e SET e.activo = false, e.deletedAt = CURRENT_TIMESTAMP WHERE e.programa.id = :programaId AND e.activo = true")
    int softDeleteByProgramaId(@Param("programaId") UUID programaId);

    /** Igual que {@link #softDeleteByProgramaId}, pero por lista de ids (BE-13: evita load+save por fila). */
    @Modifying
    @Query("UPDATE Estudiante e SET e.activo = false, e.deletedAt = CURRENT_TIMESTAMP WHERE e.id IN :ids AND e.activo = true")
    int softDeleteByIdIn(@Param("ids") List<UUID> ids);

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

    /**
     * Busqueda de estudiantes por texto libre y filtros.
     *
     * <p>Compara con {@code novacrm_normalizar} (V38): asi "jose perez"
     * encuentra a «José Pérez» y "PEREZ" encuentra a «Pérez». Antes comparaba
     * con LOWER(), que ignora la caja pero no las tildes, y en esta cohorte
     * —donde 48 de 108 nombres llevan tilde— eso dejaba fuera a casi la mitad
     * de la lista.
     *
     * <p>Las funciones se invocan por su nombre y no con {@code FUNCTION('..')}:
     * esa forma generica no consulta el registro de funciones, asi que Hibernate
     * da el resultado por {@code Object} y rechaza el LIKE al crear el
     * repositorio. Estan registradas en {@code FuncionesDeNormalizacion}.
     *
     * <p>El nombre se compara completo y en los dos ordenes —"nombre apellidos"
     * y "apellidos nombre"— porque las dos columnas estan separadas y quien
     * busca escribe el nombre entero: comparando columna por columna, "Juan
     * Perez" no coincidia con nada.
     */
    @Query("""
            SELECT e FROM Estudiante e
            WHERE e.activo = true
              AND (:q IS NULL
                   OR novacrm_normalizar(CONCAT(e.nombre, ' ', e.apellido))
                        LIKE CONCAT('%', novacrm_normalizar(CAST(:q AS string)), '%')
                   OR novacrm_normalizar(CONCAT(e.apellido, ' ', e.nombre))
                        LIKE CONCAT('%', novacrm_normalizar(CAST(:q AS string)), '%')
                   OR novacrm_normalizar(e.email)
                        LIKE CONCAT('%', novacrm_normalizar(CAST(:q AS string)), '%')
                   OR novacrm_normalizar(e.ciudad)
                        LIKE CONCAT('%', novacrm_normalizar(CAST(:q AS string)), '%')
                   OR novacrm_solo_alfanumerico(e.numeroDocumento)
                        LIKE CONCAT('%', novacrm_solo_alfanumerico(CAST(:q AS string)), '%'))
              AND (:programaId IS NULL OR e.programa.id = :programaId)
              AND (:ciudad IS NULL
                   OR novacrm_normalizar(e.ciudad) = novacrm_normalizar(CAST(:ciudad AS string)))
              AND (:estadoAcademico IS NULL OR e.estadoAcademico = :estadoAcademico)
              AND (:estadoEmpleabilidad IS NULL OR e.estadoEmpleabilidad = :estadoEmpleabilidad)
            """)
    @EntityGraph(attributePaths = "programa")
    Page<Estudiante> buscarAvanzado(@Param("q") String q,
                                    @Param("programaId") UUID programaId,
                                    @Param("ciudad") String ciudad,
                                    @Param("estadoAcademico") EstadoAcademico estadoAcademico,
                                    @Param("estadoEmpleabilidad") EstadoEmpleabilidad estadoEmpleabilidad,
                                    Pageable pageable);

    /**
     * Participantes activos cuyo nombre completo normaliza igual que el dado.
     *
     * <p>Es la ultima red de la deduplicacion al importar: cuando la fila no
     * trae documento y el correo esta escrito distinto, lo unico que queda para
     * reconocer a la persona es el nombre. Devuelve lista y no un opcional a
     * proposito —hay homonimos— para que quien llama pueda negarse a elegir en
     * vez de fusionar a dos personas distintas.
     */
    @Query(value = """
            SELECT e.* FROM estudiante e
            WHERE e.activo = true
              AND novacrm_normalizar(CAST(:nombreCompleto AS text)) IN (
                    novacrm_normalizar(e.nombre || ' ' || e.apellidos),
                    novacrm_normalizar(e.apellidos || ' ' || e.nombre))
            """, nativeQuery = true)
    List<Estudiante> buscarPorNombreCompletoNormalizado(@Param("nombreCompleto") String nombreCompleto);

    /** El estudiante con ese correo, sin importar como este escrita la caja. */
    @Query(value = """
            SELECT e.* FROM estudiante e
            WHERE lower(btrim(e.email)) = lower(btrim(CAST(:email AS text)))
            LIMIT 1
            """, nativeQuery = true)
    Optional<Estudiante> findByEmailIgnoreCase(@Param("email") String email);

    /** El estudiante con ese documento, ignorando puntos, guiones y espacios. */
    @Query(value = """
            SELECT e.* FROM estudiante e
            WHERE novacrm_solo_alfanumerico(e.numero_documento) IS NOT NULL
              AND novacrm_solo_alfanumerico(e.numero_documento)
                  = novacrm_solo_alfanumerico(CAST(:documento AS text))
            LIMIT 1
            """, nativeQuery = true)
    Optional<Estudiante> findByDocumentoNormalizado(@Param("documento") String documento);

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
