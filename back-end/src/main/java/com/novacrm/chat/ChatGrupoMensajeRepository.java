package com.novacrm.chat;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChatGrupoMensajeRepository extends JpaRepository<ChatGrupoMensaje, UUID> {
    List<ChatGrupoMensaje> findByGrupoIdOrderByCreatedAtDescSecuenciaDesc(UUID grupoId, Pageable pageable);

    /**
     * Busca dentro de un grupo, sin distinguir tildes ni mayusculas.
     *
     * <p>Con la misma funcion que el chat de dos y que la busqueda de personas:
     * tres sitios buscando texto escrito por gente, con la misma regla.
     */
    @org.springframework.data.jpa.repository.Query("""
            select m from ChatGrupoMensaje m
            join fetch m.remitente
            where m.grupo.id = :grupoId
              and novacrm_normalizar(m.contenido)
                    like concat('%', novacrm_normalizar(cast(:q as string)), '%')
            order by m.createdAt desc, m.secuencia desc
            """)
    List<ChatGrupoMensaje> buscarEnElGrupo(
            @org.springframework.data.repository.query.Param("grupoId") UUID grupoId,
            @org.springframework.data.repository.query.Param("q") String q,
            Pageable pageable);
}
