package com.novacrm.perfil;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FormacionAdicionalRepository extends JpaRepository<FormacionAdicional, UUID> {
    List<FormacionAdicional> findByEstudianteIdOrderByFechaInicioDesc(UUID estudianteId);
}
