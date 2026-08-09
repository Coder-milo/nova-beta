package com.novacrm.notificacion;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotificacionRepository extends JpaRepository<Notificacion, UUID> {
    Page<Notificacion> findByEstudianteIdOrderByCreatedAtDesc(UUID estudianteId, Pageable pageable);
    long countByEstudianteIdAndLeidaFalse(UUID estudianteId);
    List<Notificacion> findByEstudianteIdAndLeidaFalse(UUID estudianteId);

    /**
     * Si ya hay un aviso sin leer de ese mismo origen.
     *
     * <p>Sirve para no apilar uno por mensaje: en una conversacion de veinte
     * frases seguidas, veinte avisos identicos no informan mas que uno y
     * dejan la campana inservible para lo demas.
     */
    boolean existsByEstudianteIdAndTipoAndReferenciaIdAndLeidaFalse(
            UUID estudianteId, String tipo, String referenciaId);
}
