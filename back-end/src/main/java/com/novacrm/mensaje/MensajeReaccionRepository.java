package com.novacrm.mensaje;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MensajeReaccionRepository extends JpaRepository<MensajeReaccion, UUID> {

    /**
     * La reaccion concreta de una persona sobre un turno.
     *
     * <p>Se usa para alternar: pulsar el mismo emoji dos veces lo quita en vez
     * de acumularlo, que es como se comporta cualquier chat y lo que evita que
     * alguien pueda inflar un contador a base de pulsaciones.
     */
    Optional<MensajeReaccion> findByTurnoIdAndAutorEmailAndEmoji(
            UUID turnoId, String autorEmail, String emoji);

    /**
     * Las reacciones de un turno, de la mas antigua a la mas nueva.
     *
     * <p>Se consulta la tabla en vez de leer {@code turno.getReacciones()}:
     * esa coleccion es la que Hibernate cargo al principio de la transaccion y
     * no refleja lo que se acaba de guardar, de modo que alternar una reaccion
     * devolvia el estado anterior al cambio.
     *
     * <p>El orden por fecha da botones estables entre recargas; el conjunto de
     * la entidad no garantiza ninguno.
     */
    java.util.List<MensajeReaccion> findByTurnoIdOrderByCreatedAtAsc(UUID turnoId);
}
