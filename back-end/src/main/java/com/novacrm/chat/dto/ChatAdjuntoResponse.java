package com.novacrm.chat.dto;

import java.util.UUID;

/**
 * Un adjunto tal y como lo ve la pantalla.
 *
 * <p>No lleva la clave de almacenamiento: el archivo se pide por su id a un
 * endpoint que comprueba quien pregunta. Publicar la clave dejaria bajarlo a
 * cualquiera que la adivinara, sin pasar por esa comprobacion.
 */
public record ChatAdjuntoResponse(
        UUID id,
        String nombre,
        String contentType,
        long tamano,
        boolean esAudio,
        Integer duracionSegundos,
        String url) {

    public static ChatAdjuntoResponse de(com.novacrm.chat.ChatAdjunto adjunto) {
        return new ChatAdjuntoResponse(
                adjunto.getId(),
                adjunto.getNombre(),
                adjunto.getContentType(),
                adjunto.getTamano(),
                adjunto.esAudio(),
                adjunto.getDuracionSegundos(),
                "/api/v1/chats/adjuntos/" + adjunto.getId());
    }
}
