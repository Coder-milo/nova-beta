package com.novacrm.hv;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlantillaHvRepository extends JpaRepository<PlantillaHv, UUID> {
    List<PlantillaHv> findByActivoTrueOrderByCreatedAtDesc();
    Optional<PlantillaHv> findFirstByPredeterminadaTrueAndActivoTrue();
}
