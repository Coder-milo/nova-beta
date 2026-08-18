package com.novacrm.chat;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChatGrupoMensajeRepository extends JpaRepository<ChatGrupoMensaje, UUID> {
    List<ChatGrupoMensaje> findByGrupoIdOrderByCreatedAtDescSecuenciaDesc(UUID grupoId, Pageable pageable);

    /**
     * El tramo anterior a un punto del grupo.
     *
     * <p>Igual que en el chat de dos: abrirlo trae los ultimos doscientos y lo
     * de mas atras no habia forma de verlo.
     *
     * <p>El corte va por fecha y, a igualdad, por secuencia. Con solo la fecha,
     * dos mensajes del mismo milisegundo harian que al pedir «lo anterior» se
     * repitiera uno o se saltara otro, segun cual quedara al borde.
     */
    @org.springframework.data.jpa.repository.Query("""
            select m from ChatGrupoMensaje m
            join fetch m.remitente
            where m.grupo.id = :grupoId
              and (m.createdAt < :fecha
                   or (m.createdAt = :fecha and m.secuencia < :secuencia))
            order by m.createdAt desc, m.secuencia desc
            """)
    List<ChatGrupoMensaje> anterioresA(
            @org.springframework.data.repository.query.Param("grupoId") UUID grupoId,
            @org.springframework.data.repository.query.Param("fecha") java.time.Instant fecha,
            @org.springframework.data.repository.query.Param("secuencia") Long secuencia,
            Pageable pageable);

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
