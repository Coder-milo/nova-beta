package com.novacrm.auditoria.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record AuditoriaResponse(
        UUID id,
        LocalDateTime fecha,
        String usuario,
        String modulo,
        String accion,
        String entidad,
        String registroId,
        String registroNombre,
        String datosAnteriores,
        String datosNuevos,
        String ip
) {}
