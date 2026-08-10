package com.novacrm.chat.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Una fila de la lista de conversaciones.
 *
 * <p>Lo que hace falta para pintar la bandeja sin abrir nada: con quien, que
 * fue lo ultimo y cuanto queda por leer. El contenido va recortado porque en
 * la lista solo cabe una linea, y mandar el mensaje entero de cada
 * conversacion para ensenar treinta caracteres es traer de mas.
 *
 * @param mioElUltimo si el ultimo lo escribio quien mira, para pintar «Tu:»
 */
public record ChatConversacionResponse(
        UUID contactoId,
        String nombre,
        String fotoUrl,
        String ultimoMensaje,
        Instant ultimaFecha,
        boolean mioElUltimo,
        long sinLeer) { }
