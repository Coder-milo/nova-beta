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
}
