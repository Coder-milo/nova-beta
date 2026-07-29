package com.novacrm.certificacion;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CertificacionRepository extends JpaRepository<Certificacion, UUID> {
    List<Certificacion> findByProgramaId(UUID programaId);
}
