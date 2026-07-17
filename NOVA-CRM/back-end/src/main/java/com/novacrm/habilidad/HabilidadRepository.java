package com.novacrm.habilidad;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface HabilidadRepository extends JpaRepository<Habilidad, UUID> {
    Optional<Habilidad> findByNombre(String nombre);
}
