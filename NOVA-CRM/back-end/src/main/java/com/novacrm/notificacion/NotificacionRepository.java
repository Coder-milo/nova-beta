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
}
