package com.novacrm.catalogo.nivel_ingles;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface NivelInglesRepository extends JpaRepository<NivelIngles, UUID> {
    Optional<NivelIngles> findByCodigo(String codigo);
}
