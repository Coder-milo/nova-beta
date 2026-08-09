package com.novacrm.chat;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ChatDirectoMensajeRepository extends JpaRepository<ChatDirectoMensaje, UUID> {

    /**
     * El tramo mas reciente de la conversacion, del mas nuevo al mas viejo.
     *
     * <p>Se pide acotado y no entero: dos personas que se escriben a diario
     * acumulan miles de mensajes, y abrir el chat los traia todos cada vez.
     * Quien abre una conversacion quiere lo ultimo; lo de hace meses no se lee
     * al entrar. Se invierte en el servicio para pintarlo en orden.
     */
    @Query("""
            select m from ChatDirectoMensaje m
            join fetch m.remitente
            join fetch m.destinatario
            where (m.remitente.id = :uno and m.destinatario.id = :otro)
               or (m.remitente.id = :otro and m.destinatario.id = :uno)
            order by m.createdAt desc
            """)
    List<ChatDirectoMensaje> ultimosDeLaConversacion(@Param("uno") UUID uno, @Param("otro") UUID otro,
                                                     Pageable pageable);
}
