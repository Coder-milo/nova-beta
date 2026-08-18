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
 * @param archivada   si quien mira la aparto de su bandeja. Viaja resuelto por
 *                    el servidor porque la regla no es «esta archivada» sino
 *                    «esta archivada y no ha pasado nada desde entonces»: la
 *                    pantalla no tiene por que saber eso.
 */
public record ChatConversacionResponse(
        UUID contactoId,
        String nombre,
        String fotoUrl,
        String ultimoMensaje,
        Instant ultimaFecha,
        boolean mioElUltimo,
        long sinLeer,
        boolean archivada) { }
