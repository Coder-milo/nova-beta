package com.novacrm.whatsapp;

import java.util.UUID;

/**
 * Guarda la configuracion del canal. El {@code token} es el unico campo que
 * solo viaja de ida: se cifra y se descarta, nunca vuelve al frontend.
 *
 * @param token null = conservar el guardado. Si no hay ninguno guardado, el
 *              canal no puede activarse.
 */
public record WhatsappRequest(
        String numeroWhatsapp,
        String phoneId,
        String token,
        Boolean activo) {
}
