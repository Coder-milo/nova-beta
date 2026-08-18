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

    @EntityGraph(attributePaths = "programa")
    List<Estudiante> findAllByProgramaIdAndActivoTrue(UUID programaId);

    // Aqui vivia findByEmail, con igualdad exacta, y se colo en tres sitios: el
    // historial del estudiante, sus plataformas y el conteo previo de la
    // importacion. Los correos se cargaron desde Excel tal y como venian
    // escritos y algunos llevan mayusculas, asi que la igualdad exacta dejaba a
    // esas personas fuera de su propio portal. Se quita el metodo, y no solo sus
    // usos, para que la proxima pantalla no vuelva a alcanzarlo por descuido:
    // el que hay que usar es findByEmailIgnoreCase, mas abajo.

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

    /** Cuántos lleva alguien. Alimenta el desplegable, para no repartir a ciegas. */
    long countByResponsableIdAndActivoTrue(UUID responsableId);

    /** «Mis estudiantes»: la consulta que justifica que el responsable exista. */
    Page<Estudiante> findByResponsableIdAndActivoTrue(UUID responsableId, Pageable pageable);

    /** Los que no lleva nadie. Es lo que hay que ver para repartir. */
    Page<Estudiante> findByResponsableIsNullAndActivoTrue(Pageable pageable);

    // --- Dashboard: KPIs y variaciones temporales ---
    long countByCreatedAtGreaterThanEqual(Instant desde);
    long countByCreatedAtBetween(Instant desde, Instant hasta);
    long countByEstadoAcademico(EstadoAcademico estado);
    long countByEstadoAcademicoAndCreatedAtLessThan(EstadoAcademico estado, Instant hasta);
    long countByEstadoEmpleabilidad(EstadoEmpleabilidad estado);

    /**
     * Cuantos estan trabajando de verdad.
     *
     * <p>«Empleado» son dos cosas. El enum {@code estadoEmpleabilidad} viene de
     * la hoja antigua y solo lo escriben la importacion y la edicion manual; la
     * colocacion es el registro real —empresa, fecha, salario— y es por donde
     * entra todo el que se coloca por el CRM. Contando solo el enum, la grafica
     * de empleabilidad del panel dejaba fuera justamente los resultados que el
     * programa consiguio: la persona registraba su colocacion y la dona seguia
     * contandola como «buscando».
     */
    @Query("""
            select count(e) from Estudiante e
            where e.estadoEmpleabilidad = com.novacrm.estudiante.EstadoEmpleabilidad.EMPLEADO
               or exists (select 1 from Colocacion c
                          where c.estudiante.id = e.id and c.activa = true)
            """)
    long contarEmpleadosConColocacionOEnum();

    /** Los de ese estado que ademas no tienen ninguna colocacion vigente. */
    @Query("""
            select count(e) from Estudiante e
            where e.estadoEmpleabilidad = :estado
              and not exists (select 1 from Colocacion c
                              where c.estudiante.id = e.id and c.activa = true)
            """)
    long contarPorEmpleabilidadSinColocacion(@Param("estado") EstadoEmpleabilidad estado);

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

    /** Los que siguen en el programa. Para poner «X de Y» en los avisos. */
    long countByActivoTrue();

    @Modifying
    @Query("UPDATE Estudiante e SET e.activo = false, e.deletedAt = CURRENT_INSTANT WHERE e.programa.id = :programaId AND e.activo = true")
    int softDeleteByProgramaId(@Param("programaId") UUID programaId);

    /** Igual que {@link #softDeleteByProgramaId}, pero por lista de ids (BE-13: evita load+save por fila). */
    @Modifying
    @Query("UPDATE Estudiante e SET e.activo = false, e.deletedAt = CURRENT_INSTANT WHERE e.id IN :ids AND e.activo = true")
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
     * Companeros del mismo programa que coinciden con lo escrito.
     *
     * <p>Para el buscador del chat entre estudiantes. Normaliza igual que la
     * busqueda del equipo: comparando con LOWER(), escribir "jose" no
     * encontraba a «José» ni "nunez" a «Núñez», y en esta cohorte 48 de 108
     * nombres llevan tilde. Quien busca a un companero teclea el nombre como
     * suena, no como esta escrito en la ficha.
     *
     * <p>El filtro va en la consulta y no en memoria: traer el programa entero
     * para descartarlo en Java funciona con 108 personas y deja de funcionar
     * sin avisar cuando sean mil.
     */
    @Query("""
            SELECT e FROM Estudiante e
            WHERE e.activo = true
              AND e.programa.id = :programaId
              AND e.id <> :excluido
              AND (novacrm_normalizar(CONCAT(e.nombre, ' ', e.apellido))
                        LIKE CONCAT('%', novacrm_normalizar(CAST(:q AS string)), '%')
                   OR novacrm_normalizar(CONCAT(e.apellido, ' ', e.nombre))
                        LIKE CONCAT('%', novacrm_normalizar(CAST(:q AS string)), '%'))
            ORDER BY e.nombre ASC, e.apellido ASC
            """)
    List<Estudiante> companerosQueCoinciden(@Param("programaId") UUID programaId,
                                            @Param("excluido") UUID excluido,
                                            @Param("q") String q,
                                            Pageable pageable);

    @Query("""
            SELECT e FROM Estudiante e
            WHERE e.activo = true
              AND e.id <> :excluido
              AND (novacrm_normalizar(CONCAT(e.nombre, ' ', e.apellido))
                        LIKE CONCAT('%', novacrm_normalizar(CAST(:q AS string)), '%')
                   OR novacrm_normalizar(CONCAT(e.apellido, ' ', e.nombre))
                        LIKE CONCAT('%', novacrm_normalizar(CAST(:q AS string)), '%'))
            ORDER BY e.nombre ASC, e.apellido ASC
            """)
    List<Estudiante> todosLosEstudiantesQueCoinciden(@Param("excluido") UUID excluido,
                                                     @Param("q") String q,
                                                     Pageable pageable);

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

    /**
     * Cuantos activos hay en cada ciudad, tal y como esta escrita en la ficha.
     *
     * <p>Devuelve el texto crudo a proposito. La ciudad entro del Excel de
     * matricula y es texto libre: normalizarla en SQL obligaria a repetir en la
     * consulta la tabla de alias que ya vive en {@code MunicipiosDelAtlantico},
     * y a mantener las dos a la vez. Aqui se agrupa —seis u ocho filas— y el
     * emparejado con el municipio se hace una sola vez en Java.
     *
     * <p>Incluye las fichas sin ciudad: una persona sin ubicar sigue siendo una
     * persona del programa, y no contarla haria que los totales del mapa no
     * cuadraran con los del resto del panel.
     *
     * @param programaId nulo para todos los programas
     */
    @org.springframework.data.jpa.repository.Query("""
            SELECT COALESCE(e.ciudad, '') AS ciudad, COUNT(e) AS total
            FROM Estudiante e
            WHERE e.activo = true
              AND (:programaId IS NULL OR e.programa.id = :programaId)
            GROUP BY COALESCE(e.ciudad, '')
            """)
    List<CiudadConTotal> contarActivosPorCiudad(
            @org.springframework.data.repository.query.Param("programaId") UUID programaId);

    /** Proyeccion de {@link #contarActivosPorCiudad}. */
    interface CiudadConTotal {
        String getCiudad();
        long getTotal();
    }

    /**
     * Activos con correo que todavia no pueden entrar al sistema.
     *
     * <p>Sin cuenta no hay portal, y sin portal no se ve ni una oferta: es el
     * primer eslabon de la cadena y el mas facil de no mirar, porque no falla
     * nada —simplemente no pasa nada—.
     *
     * <p>Excluye a quien no tiene correo: a esos no se les puede crear cuenta
     * aunque se quiera, y ya salen en el aviso de datos incompletos. Meterlos
     * aqui daria un numero que no se puede bajar.
     */
    @org.springframework.data.jpa.repository.Query("""
            SELECT COUNT(e) FROM Estudiante e
            WHERE e.activo = true
              AND e.email IS NOT NULL AND e.email <> ''
              AND NOT EXISTS (
                  SELECT 1 FROM Usuario u WHERE LOWER(u.email) = LOWER(e.email))
            """)
    long contarActivosSinCuenta();

}
