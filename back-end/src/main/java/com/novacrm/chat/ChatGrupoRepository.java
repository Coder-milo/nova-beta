package com.novacrm.chat;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ChatGrupoRepository extends JpaRepository<ChatGrupo, UUID> {

    @Query("SELECT g FROM ChatGrupo g JOIN g.miembros m WHERE m.estudiante.id = :estudianteId ORDER BY g.updatedAt DESC")
    List<ChatGrupo> gruposDeEstudiante(@Param("estudianteId") UUID estudianteId);
}
