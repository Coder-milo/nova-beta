package com.novacrm.whatsapp;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface MensajeWhatsappRepository extends JpaRepository<MensajeWhatsapp, UUID> {
    List<MensajeWhatsapp> findByProgramaIdOrderByCreatedAtDesc(UUID programaId);
    List<MensajeWhatsapp> findByEstudianteIdOrderByCreatedAtDesc(UUID estudianteId);
    boolean existsByEstudianteIdAndTipoAndCreatedAtAfter(UUID estudianteId, MensajeWhatsapp.Tipo tipo, Instant fechaDesde);
    long countByProgramaIdAndTipoAndCreatedAtAfter(UUID programaId, MensajeWhatsapp.Tipo tipo, Instant fechaDesde);
}
