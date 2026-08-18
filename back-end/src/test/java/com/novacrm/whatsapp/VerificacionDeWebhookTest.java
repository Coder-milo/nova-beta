package com.novacrm.whatsapp;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * La ruta del webhook es publica a proposito —la llama Meta, no el navegador— y
 * ademas esta excluida del limite de peticiones. Su unica defensa es esta
 * comprobacion, asi que conviene fijarla.
 */
class VerificacionDeWebhookTest {

    private static final String TOKEN = "token-de-verificacion-configurado";

    @Test
    void aceptaElTokenConfigurado() {
        assertTrue(WhatsappWebhookService.tokenDeVerificacionValido("subscribe", TOKEN, TOKEN));
    }

    @Test
    void rechazaOtroToken() {
        assertFalse(WhatsappWebhookService.tokenDeVerificacionValido("subscribe", "otro", TOKEN));
    }

    @Test
    void rechazaUnModoQueNoEsSubscribe() {
        assertFalse(WhatsappWebhookService.tokenDeVerificacionValido("unsubscribe", TOKEN, TOKEN));
        assertFalse(WhatsappWebhookService.tokenDeVerificacionValido(null, TOKEN, TOKEN));
    }

    /**
     * Con la variable definida pero vacia, el token esperado era la cadena vacia
     * y bastaba con mandar {@code hub.verify_token=} para pasar.
     */
    @Test
    void unTokenEsperadoVacioNoValidaANadie() {
        assertFalse(WhatsappWebhookService.tokenDeVerificacionValido("subscribe", "", ""));
        assertFalse(WhatsappWebhookService.tokenDeVerificacionValido("subscribe", "   ", "   "));
        assertFalse(WhatsappWebhookService.tokenDeVerificacionValido("subscribe", "loquesea", ""));
    }

    @Test
    void sinTokenConfiguradoNoValidaNada() {
        assertFalse(WhatsappWebhookService.tokenDeVerificacionValido("subscribe", TOKEN, null));
    }

    @Test
    void sinTokenEnLaPeticionNoValida() {
        assertFalse(WhatsappWebhookService.tokenDeVerificacionValido("subscribe", null, TOKEN));
    }
}
