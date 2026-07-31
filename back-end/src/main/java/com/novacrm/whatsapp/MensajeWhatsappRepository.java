package com.novacrm.whatsapp;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MensajeWhatsappRepository extends JpaRepository<MensajeWhatsapp, UUID> {
    List<MensajeWhatsapp> findByProgramaIdOrderByCreatedAtDesc(UUID programaId);
}
