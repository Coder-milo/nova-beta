package com.novacrm.chat;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ReporteDeChatRepository extends JpaRepository<ReporteDeChat, UUID> {

    Page<ReporteDeChat> findByEstadoOrderByCreatedAtDesc(String estado, Pageable pageable);

    Page<ReporteDeChat> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /**
     * Si ya hay un reporte abierto de esa persona sobre esa otra.
     *
     * <p>Evita que pulsar el botón dos veces —o pulsarlo cada vez que llega un
     * mensaje— llene la bandeja del equipo con el mismo caso repetido.
     */
    boolean existsByDenuncianteIdAndDenunciadoIdAndEstado(
            UUID denuncianteId, UUID denunciadoId, String estado);
}
