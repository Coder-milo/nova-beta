package com.novacrm.chat;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ChatDirectoMensajeRepository extends JpaRepository<ChatDirectoMensaje, UUID> {

    /**
     * El tramo mas reciente de la conversacion, del mas nuevo al mas viejo.
     *
     * <p>Se pide acotado y no entero: dos personas que se escriben a diario
     * acumulan miles de mensajes, y abrir el chat los traia todos cada vez.
     * Quien abre una conversacion quiere lo ultimo; lo de hace meses no se lee
     * al entrar. Se invierte en el servicio para pintarlo en orden.
     */
    @Query("""
            select m from ChatDirectoMensaje m
            join fetch m.remitente
            join fetch m.destinatario
            where (m.remitente.id = :uno and m.destinatario.id = :otro)
               or (m.remitente.id = :otro and m.destinatario.id = :uno)
            order by m.createdAt desc, m.secuencia desc
            """)
    List<ChatDirectoMensaje> ultimosDeLaConversacion(@Param("uno") UUID uno, @Param("otro") UUID otro,
                                                     Pageable pageable);

    /**
     * Busca dentro de una conversacion, sin distinguir tildes ni mayusculas.
     *
     * <p>Con la misma funcion que la busqueda de personas y por el mismo
     * motivo: quien escribio «práctica» rara vez lo teclea con tilde al
     * buscarlo, y una busqueda que exige acertar el acento no encuentra lo que
     * la persona sabe que dijo.
     *
     * <p>De lo mas nuevo a lo mas viejo: lo que se busca en un chat suele ser
     * algo reciente que no se quiere subir a mano.
     *
     * <p>El {@code like '%...%'} recorre la tabla: no hay indice que sirva para
     * un patron que empieza por comodin. Hoy sobra —la tabla ronda las decenas
     * de filas— y por eso no se indexa: seria mantenimiento a cambio de nada.
     * Cuando pase de unas cien mil, la salida esta preparada: {@code V38} dejo
     * {@code novacrm_normalizar} declarada {@code IMMUTABLE} justamente para
     * poder colgarle un indice GIN de trigramas
     * ({@code CREATE EXTENSION pg_trgm}). Se mide antes de ponerlo.
     */
    @Query("""
            select m from ChatDirectoMensaje m
            join fetch m.remitente
            where ((m.remitente.id = :uno and m.destinatario.id = :otro)
                or (m.remitente.id = :otro and m.destinatario.id = :uno))
              and novacrm_normalizar(m.contenido)
                    like concat('%', novacrm_normalizar(cast(:q as string)), '%')
            order by m.createdAt desc, m.secuencia desc
            """)
    List<ChatDirectoMensaje> buscarEnLaConversacion(@Param("uno") UUID uno, @Param("otro") UUID otro,
                                                    @Param("q") String q, Pageable pageable);

    /**
     * El tramo anterior a un punto de la conversacion.
     *
     * <p>Abrir un chat trae los ultimos doscientos, y hasta ahora lo de mas
     * atras no habia forma de verlo: existia y no se alcanzaba, sin nada en
     * pantalla que lo dijera. Esto es lo que hay antes de un mensaje dado.
     *
     * <p>El corte va por fecha y, a igualdad, por secuencia. Con solo la fecha,
     * dos mensajes del mismo milisegundo harian que al pedir «lo anterior» se
     * repitiera uno o se saltara otro, segun cual quedara al borde.
     */
    @Query("""
            select m from ChatDirectoMensaje m
            join fetch m.remitente
            join fetch m.destinatario
            where ((m.remitente.id = :uno and m.destinatario.id = :otro)
                or (m.remitente.id = :otro and m.destinatario.id = :uno))
              and (m.createdAt < :fecha
                   or (m.createdAt = :fecha and m.secuencia < :secuencia))
            order by m.createdAt desc, m.secuencia desc
            """)
    List<ChatDirectoMensaje> anterioresA(@Param("uno") UUID uno, @Param("otro") UUID otro,
                                         @Param("fecha") java.time.Instant fecha,
                                         @Param("secuencia") Long secuencia,
                                         Pageable pageable);

    /** Con quien se ha hablado, con lo ultimo que se dijo. Una fila por persona. */
    interface ResumenConversacion {
        UUID getOtroId();
        String getUltimoMensaje();
        java.time.Instant getUltimaFecha();
        boolean getMioElUltimo();
    }

    /**
     * La lista de conversaciones, una fila por interlocutor.
     *
     * <p>Nativa y con {@code DISTINCT ON}: en JPQL habria que traerse los
     * mensajes y agrupar en memoria, que es justo lo que no se quiere de una
     * pantalla que se abre a diario. La base ya sabe hacerlo.
     */
    @Query(value = """
            SELECT DISTINCT ON (t.otro_id)
                   t.otro_id      AS otroId,
                   t.contenido    AS ultimoMensaje,
                   t.created_at   AS ultimaFecha,
                   (t.remitente_id = :yo) AS mioElUltimo
            FROM (
                SELECT CASE WHEN m.remitente_id = :yo THEN m.destinatario_id ELSE m.remitente_id END AS otro_id,
                       m.contenido, m.created_at, m.secuencia, m.remitente_id
                FROM chat_directo_mensaje m
                WHERE m.remitente_id = :yo OR m.destinatario_id = :yo
            ) t
            ORDER BY t.otro_id, t.created_at DESC, t.secuencia DESC
            """, nativeQuery = true)
    List<ResumenConversacion> conversacionesDe(@Param("yo") UUID yo);

    /** Cuantos sin leer manda cada persona. Solo aparecen quienes tienen alguno. */
    interface PendientesPorContacto {
        UUID getRemitenteId();
        long getTotal();
    }

    @Query(value = """
            SELECT m.remitente_id AS remitenteId, COUNT(*) AS total
            FROM chat_directo_mensaje m
            WHERE m.destinatario_id = :yo AND m.leido_at IS NULL
            GROUP BY m.remitente_id
            """, nativeQuery = true)
    List<PendientesPorContacto> sinLeerPorContacto(@Param("yo") UUID yo);
}
