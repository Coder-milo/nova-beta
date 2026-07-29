package com.novacrm.linkedin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface LinkedinConfiguracionRepository extends JpaRepository<LinkedinConfiguracion, UUID> {
}
