package com.novacrm.mensaje;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MensajeEstudianteRepository extends JpaRepository<MensajeEstudiante, UUID> {
    List<MensajeEstudiante> findByEstudianteIdOrderByCreatedAtDesc(UUID estudianteId);
    List<MensajeEstudiante> findByEstudianteIdAndEstado(UUID estudianteId, EstadoMensaje estado);
    List<MensajeEstudiante> findAllByOrderByCreatedAtDesc();
}
