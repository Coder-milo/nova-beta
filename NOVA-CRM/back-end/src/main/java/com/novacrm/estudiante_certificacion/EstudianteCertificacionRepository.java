package com.novacrm.estudiante_certificacion;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EstudianteCertificacionRepository extends JpaRepository<EstudianteCertificacion, UUID> {
    List<EstudianteCertificacion> findByEstudianteId(UUID estudianteId);
    Optional<EstudianteCertificacion> findByEstudianteIdAndCertificacionId(UUID estudianteId, UUID certificacionId);
    List<EstudianteCertificacion> findByEmitidaFalse();
}
