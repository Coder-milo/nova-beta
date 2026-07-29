package com.novacrm.chat;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ChatDirectoMensajeRepository extends JpaRepository<ChatDirectoMensaje, UUID> {

    @Query("""
            select m from ChatDirectoMensaje m
            join fetch m.remitente
            join fetch m.destinatario
            where (m.remitente.id = :uno and m.destinatario.id = :otro)
               or (m.remitente.id = :otro and m.destinatario.id = :uno)
            order by m.createdAt asc
            """)
    List<ChatDirectoMensaje> conversacion(@Param("uno") UUID uno, @Param("otro") UUID otro);
}
