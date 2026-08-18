package com.novacrm.chat;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BloqueoDeChatRepository extends JpaRepository<BloqueoDeChat, UUID> {

    Optional<BloqueoDeChat> findByBloqueadorIdAndBloqueadoId(UUID bloqueadorId, UUID bloqueadoId);

    /**
     * Si hay bloqueo entre dos, lo haya puesto quien lo haya puesto.
     *
     * <p>Se mira en los dos sentidos a proposito. Un bloqueo que solo corta en
     * una direccion deja que quien bloquea siga escribiendo a quien le bloqueo,
     * y eso convierte una herramienta para protegerse en una para insistir.
     */
    @Query("""
            SELECT COUNT(b) > 0 FROM BloqueoDeChat b
            WHERE (b.bloqueador.id = :uno AND b.bloqueado.id = :otro)
               OR (b.bloqueador.id = :otro AND b.bloqueado.id = :uno)
            """)
    boolean hayBloqueoEntre(@Param("uno") UUID uno, @Param("otro") UUID otro);

    /** A quienes bloqueo esta persona, para poder deshacerlo. */
    @Query("SELECT b.bloqueado.id FROM BloqueoDeChat b WHERE b.bloqueador.id = :yo")
    List<UUID> aQuienesBloqueo(@Param("yo") UUID yo);

    /**
     * Con quienes no hay chat posible: los que bloqueo y los que le bloquearon.
     *
     * <p>Sirve para no ofrecerlos al buscar. Una fila que siempre da error al
     * pulsarla es peor que no estar.
     */
    @Query("""
            SELECT CASE WHEN b.bloqueador.id = :yo THEN b.bloqueado.id ELSE b.bloqueador.id END
            FROM BloqueoDeChat b
            WHERE b.bloqueador.id = :yo OR b.bloqueado.id = :yo
            """)
    List<UUID> sinChatPosibleCon(@Param("yo") UUID yo);
}
