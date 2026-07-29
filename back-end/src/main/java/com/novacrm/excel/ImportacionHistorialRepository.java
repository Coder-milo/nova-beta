package com.novacrm.excel;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ImportacionHistorialRepository extends JpaRepository<ImportacionHistorial, UUID> {
    List<ImportacionHistorial> findTop20ByOrderByCreatedAtDesc();
}
