package com.novacrm.vacante;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface VacanteRepository extends JpaRepository<Vacante, UUID> {
    Page<Vacante> findByActivoTrueOrderByCreatedAtDesc(Pageable pageable);
    Optional<Vacante> findByHashDedup(String hashDedup);
    long countByActivoTrue();
}
