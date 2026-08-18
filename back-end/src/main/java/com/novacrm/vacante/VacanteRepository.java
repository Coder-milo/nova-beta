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

    /** La misma oferta vista desde otra fuente: dedup cruzado de contenido. */
    Optional<Vacante> findByHashContenido(String hashContenido);

    long countByActivoTrue();

    /**
     * Vacantes que se pueden ofrecer hoy: abiertas y sin vencer.
     *
     * <p>La columna {@code fechaExpiracion} existia desde la primera version y
     * no la leia ninguna consulta, asi que las ofertas caducadas se seguian
     * recomendando y los estudiantes se postulaban a plazas ya cerradas.
     *
     * <p>Excluye dos cosas que no son «publicadas» aunque esten activas:
     *
     * <ul>
     *   <li><strong>Los borradores.</strong> {@code Vacante.borrador} dice que
     *       no lo ve nadie mas que quien lo escribe, y la cola de revision si
     *       lo cumplia, pero esta consulta no: un texto a medio escribir de una
     *       empresa aparecia en el listado que ve el estudiante.
     *   <li><strong>Lo que llega del formulario publico y nadie ha mirado.</strong>
     *       Una oferta sugerida por un participante si se ve sin revisar —la
     *       escribio alguien conocido y solo se le niega el matching—, pero
     *       esto lo escribe un desconocido de internet. Enseñarlo antes de que
     *       una persona lo lea es publicar lo que mande cualquiera.
     * </ul>
     */
    @Query("""
            SELECT v FROM Vacante v
            WHERE v.activo = true
              AND v.borrador = false
              AND (v.revisada = true OR COALESCE(v.fuente, '') <> 'FORMULARIO_PUBLICO')
              AND (v.fechaExpiracion IS NULL OR v.fechaExpiracion > :ahora)
            ORDER BY v.createdAt DESC
            """)
    Page<Vacante> findVigentes(@Param("ahora") LocalDateTime ahora, Pageable pageable);

    @Query("""
            SELECT COUNT(v) FROM Vacante v
            WHERE v.activo = true
              AND v.borrador = false
              AND (v.revisada = true OR COALESCE(v.fuente, '') <> 'FORMULARIO_PUBLICO')
              AND (v.fechaExpiracion IS NULL OR v.fechaExpiracion > :ahora)
            """)
    long contarVigentes(@Param("ahora") LocalDateTime ahora);

    /**
     * Todas las abiertas, sin paginar.
     *
     * <p>Para la depuracion bilingue, que tiene que mirar el texto de cada una:
     * el criterio vive en Java ({@code FiltroBilingue}) y no se puede escribir
     * como una clausula {@code WHERE} sin duplicarlo en SQL y condenarse a
     * mantener las dos versiones de acuerdo.
     */
    List<Vacante> findByActivoTrue();

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

    /**
     * Ofertas vigentes que esperan que alguien las valide.
     *
     * <p>Son las que registro un participante. Hasta que se validan no se le
     * recomiendan a nadie, asi que una que nadie mire no es una oferta
     * pendiente: es una oportunidad perdida en silencio. De aqui sale el aviso
     * que lo cuenta.
     */
    @Query("""
            SELECT COUNT(v) FROM Vacante v
            WHERE v.activo = true
              AND v.revisada = false
              AND (v.fechaExpiracion IS NULL OR v.fechaExpiracion > :ahora)
            """)
    long contarSinRevisar(@Param("ahora") LocalDateTime ahora);

    /**
     * Lo que espera revision del equipo.
     *
     * <p>Excluye los borradores: una empresa que esta redactando no ha pedido
     * nada, y mezclarlos llenaria la cola de textos a medias. Excluye tambien
     * las ya rechazadas —tienen la pelota del otro lado— y las cerradas.
     *
     * <p>Las de la empresa primero: alguien esta esperando del otro lado, y una
     * oferta sugerida por un estudiante ya lleva su tiempo ahi.
     */
    @Query("""
            SELECT v FROM Vacante v
            LEFT JOIN FETCH v.empresa
            WHERE v.activo = true
              AND v.revisada = false
              AND v.borrador = false
              AND v.motivoRechazo IS NULL
            ORDER BY CASE WHEN v.fuente = 'PORTAL_EMPRESA' THEN 0 ELSE 1 END, v.createdAt ASC
            """)
    List<Vacante> enColaDeRevision();

    /** Todas las de una empresa, incluidos sus borradores. Para el portal. */
    List<Vacante> findByEmpresaIdOrderByCreatedAtDesc(java.util.UUID empresaId);

    /**
     * Cuantas personas se han postulado a una vacante.
     *
     * <p>Se cuenta con una consulta y no cargando la lista porque el portal
     * pinta esta cifra en cada fila del listado: traer las postulaciones de
     * veinte vacantes para contarlas y descartarlas son veinte consultas
     * inutiles.
     */
    @Query("SELECT COUNT(p) FROM Postulacion p WHERE p.vacante.id = :vacanteId")
    long contarPostulacionesDe(@Param("vacanteId") java.util.UUID vacanteId);
}
