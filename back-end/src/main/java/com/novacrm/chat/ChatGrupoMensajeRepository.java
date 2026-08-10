package com.novacrm.chat;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChatGrupoMensajeRepository extends JpaRepository<ChatGrupoMensaje, UUID> {
    List<ChatGrupoMensaje> findByGrupoIdOrderByCreatedAtDesc(UUID grupoId, Pageable pageable);
}
