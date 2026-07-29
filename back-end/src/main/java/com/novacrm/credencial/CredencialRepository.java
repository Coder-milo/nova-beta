package com.novacrm.credencial;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CredencialRepository extends JpaRepository<Credencial, UUID> {
    Optional<Credencial> findByUuidPublico(UUID uuidPublico);
    Optional<Credencial> findByTokenVerificacion(String tokenVerificacion);
    boolean existsByEstudianteCertificacionId(UUID estudianteCertificacionId);
}
