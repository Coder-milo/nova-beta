package com.novacrm.plataforma;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlataformaRepository extends JpaRepository<Plataforma, UUID> {
    List<Plataforma> findAllByActivoTrueOrderByNombreAsc();
    Optional<Plataforma> findByCodigo(String codigo);
}