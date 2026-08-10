package com.novacrm.chat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChatGrupoMiembroRepository extends JpaRepository<ChatGrupoMiembro, UUID> {
    Optional<ChatGrupoMiembro> findByGrupoIdAndEstudianteId(UUID grupoId, UUID estudianteId);
    List<ChatGrupoMiembro> findByGrupoId(UUID grupoId);
    boolean existsByGrupoIdAndEstudianteId(UUID grupoId, UUID estudianteId);

    /** Los miembros por orden de entrada: el primero hereda ser admin. */
    List<ChatGrupoMiembro> findByGrupoIdOrderByCreatedAtAsc(UUID grupoId);
}
