package com.novacrm.mensaje;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MensajeEstudianteRepository extends JpaRepository<MensajeEstudiante, UUID> {
    List<MensajeEstudiante> findByEstudianteIdOrderByCreatedAtDesc(UUID estudianteId);
    List<MensajeEstudiante> findByEstudianteIdAndEstado(UUID estudianteId, EstadoMensaje estado);
    List<MensajeEstudiante> findAllByOrderByCreatedAtDesc();

    /**
     * Cuantos hilos estan en ese estado.
     *
     * <p>Es para el contador de la campana. La cabecera lo pedia trayendose
     * la lista entera cada 45 segundos y contandola en el navegador: todos los
     * hilos que existen, con sus adjuntos, para pintar un numero.
     */
    long countByEstado(EstadoMensaje estado);

    long countByEstudianteIdAndEstado(UUID estudianteId, EstadoMensaje estado);
}
