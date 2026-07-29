package com.novacrm.mensaje;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MensajeAdjuntoRepository extends JpaRepository<MensajeAdjunto, UUID> {
}
