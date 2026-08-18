package com.novacrm.chat;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversacionArchivadaRepository extends JpaRepository<ConversacionArchivada, UUID> {

    Optional<ConversacionArchivada> findByEstudianteIdAndContactoId(UUID estudianteId, UUID contactoId);

    /**
     * Con quien esta archivada la conversacion, y desde cuando.
     *
     * <p>Hace falta el «desde cuando» y no solo el «si»: una conversacion
     * archivada en la que despues escribieron vuelve a la bandeja. Sin la
     * fecha, archivar seria una forma de dejar de enterarse, que no es lo que
     * la gente entiende al apartar algo.
     */
    interface Archivada {
        UUID getContactoId();
        Instant getDesde();
    }

    @Query("""
            select a.contacto.id as contactoId, a.createdAt as desde
            from ConversacionArchivada a
            where a.estudiante.id = :yo
            """)
    List<Archivada> archivadasDe(@Param("yo") UUID yo);
}
