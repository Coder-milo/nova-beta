package com.novacrm.whatsapp;

import java.util.UUID;

/**
 * El canal tal y como lo consume la interfaz.
 *
 * <p>El token jamas aparece; en su lugar va {@code tokenConfigurado}, que es
 * la unica informacion que la pantalla necesita para saber si el canal puede
 * enviar. {@code configurado} distingue "sin fila en la tabla" de "fila
 * presente", igual que hace {@code personalizado} en el branding.
 */
public record WhatsappResponse(
        UUID programaId,
        String programaNombre,
        boolean configurado,
        boolean tokenConfigurado,
        String numeroWhatsapp,
        String phoneId,
        boolean activo) {

    public static WhatsappResponse vacio(UUID programaId, String programaNombre) {
        return new WhatsappResponse(programaId, programaNombre, false, false, null, null, false);
    }

    public static WhatsappResponse de(String programaNombre, ProgramaWhatsapp w) {
        return new WhatsappResponse(
                w.getProgramaId(),
                programaNombre,
                true,
                w.getTokenCifrado() != null,
                w.getNumeroWhatsapp(),
                w.getPhoneId(),
                w.isActivo());
    }
}
