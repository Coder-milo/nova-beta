package com.novacrm.mensaje;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface MensajeTurnoRepository extends JpaRepository<MensajeTurno, UUID> {

    /**
     * Los turnos de una conversacion, en orden y con todo lo que hace falta
     * para pintarlos.
     *
     * <p>Las reacciones, los adjuntos y el turno citado se traen de una vez:
     * son justo lo que se lee de cada turno al dibujar el hilo, y sin el fetch
     * una conversacion de veinte intervenciones dispara sesenta consultas.
     */
    /**
     * <p>Se ordena tambien por {@code secuencia}: {@code createdAt} lo pone el
     * reloj del sistema y dos intervenciones escritas en el mismo milisegundo
     * salen con el mismo valor, con lo que la base devolvia el orden que
     * quisiera y la conversacion podia leerse al reves.
     */
    @EntityGraph(attributePaths = {"reacciones", "adjuntos", "enRespuestaA"})
    List<MensajeTurno> findByMensajeIdOrderByCreatedAtAscSecuenciaAsc(UUID mensajeId);

    /** Cuantas intervenciones tiene cada hilo, para la lista de la bandeja. */
    @Query("SELECT t.mensaje.id, COUNT(t) FROM MensajeTurno t WHERE t.mensaje.id IN :ids GROUP BY t.mensaje.id")
    List<Object[]> contarPorMensaje(@Param("ids") List<UUID> ids);
}
