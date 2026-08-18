package com.novacrm.chat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ChatAdjuntoRepository extends JpaRepository<ChatAdjunto, UUID> {
}
