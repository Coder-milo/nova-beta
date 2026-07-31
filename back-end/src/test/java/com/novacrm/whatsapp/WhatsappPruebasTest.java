package com.novacrm.whatsapp;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class WhatsappPruebasTest {

    @Test
    void cifradoRedondea() {
        String clave = "clave-de-prueba-123";
        String original = "EAAG0tokenDeAccesoLargo1234567890";
        withClave(clave, () -> {
            String cifrado = WhatsappCrypto.cifrar(original);
            assertNotEquals(original, cifrado, "el token no puede quedar en claro");
            assertEquals(original, WhatsappCrypto.descifrar(cifrado));
        });
    }

    @Test
    void cifradoConOtraClaveNoDescifra() {
        String cifrado = withClave("clave-a", () -> WhatsappCrypto.cifrar("secreto"));
        withClave("clave-b", () -> {
            assertThrows(IllegalStateException.class, () -> WhatsappCrypto.descifrar(cifrado));
        });
    }

    @Test
    void cifradoExigeClaveDeEntorno() {
        System.clearProperty("whatsapp.test.key");
        try {
            assertThrows(com.novacrm.exception.BusinessException.class,
                    () -> WhatsappCrypto.cifrar("secreto"));
        } finally {
            System.clearProperty("whatsapp.test.key");
        }
    }

    @Test
    void normalizaDestinos() {
        assertEquals("+573001234567", WhatsappSender.normalizarDestino("300 123 4567"));
        assertEquals("+573001234567", WhatsappSender.normalizarDestino("+57 300-123-4567"));
        assertEquals("+573001234567", WhatsappSender.normalizarDestino("(300) 123 4567"));
        assertEquals("+573001234567", WhatsappSender.normalizarDestino("573001234567"));
        assertEquals("+573001234567", WhatsappSender.normalizarDestino("+573001234567"));
        assertEquals("+15551234567", WhatsappSender.normalizarDestino("+1 555 123 4567"));
        assertNull(WhatsappSender.normalizarDestino(null));
        assertNull(WhatsappSender.normalizarDestino("abc"));
        assertNull(WhatsappSender.normalizarDestino("123"));
    }

    @Test
    void firmaValidaYRechaza() {
        String cuerpo = "{\"entry\":[]}";
        String appSecret = "app-secret-de-meta";
        String firma = "sha256=" + hmacHex(cuerpo, appSecret);
        assertTrue(WhatsappWebhookService.validarFirma(cuerpo, firma, appSecret));
        assertFalse(WhatsappWebhookService.validarFirma(cuerpo, "sha256=0000", appSecret));
        assertFalse(WhatsappWebhookService.validarFirma(cuerpo, firma, "otro-secret"));
        assertFalse(WhatsappWebhookService.validarFirma(cuerpo, null, appSecret));
        assertFalse(WhatsappWebhookService.validarFirma(null, firma, appSecret));
    }

    @Test
    void parseaBotonesYTexto() {
        String evento = """
                {"entry":[{"changes":[{"value":{"messages":[
                    {"from":"573001234567","type":"interactive",
                     "interactive":{"type":"button_reply",
                        "button_reply":{"id":"match:11111111-1111-1111-1111-111111111111","title":"Sí me interesa"}}},
                    {"from":"573001234567","type":"text","text":{"body":"hola, quiero info"}}
                ]}}]}]}
                """;
        var mensajes = WhatsappWebhookService.parsear(evento);
        assertEquals(2, mensajes.size());
        assertEquals("match:11111111-1111-1111-1111-111111111111", mensajes.get(0).payload());
        assertNull(mensajes.get(1).payload());
        assertEquals("hola, quiero info", mensajes.get(1).texto());
    }

    @Test
    void parseoVacioAnteBasura() {
        assertTrue(WhatsappWebhookService.parsear("no es json").isEmpty());
        assertTrue(WhatsappWebhookService.parsear("{}").isEmpty());
    }

    private interface Accion {
        void ejecutar();
    }

    private static void withClave(String clave, Accion accion) {
        try {
            System.setProperty("WHATSAPP_TOKEN_KEY", clave);
            accion.ejecutar();
        } finally {
            System.clearProperty("WHATSAPP_TOKEN_KEY");
        }
    }

    private static <T> T withClave(String clave, java.util.function.Supplier<T> accion) {
        try {
            System.setProperty("WHATSAPP_TOKEN_KEY", clave);
            return accion.get();
        } finally {
            System.clearProperty("WHATSAPP_TOKEN_KEY");
        }
    }

    private static String hmacHex(String cuerpo, String secreto) {
        try {
            var mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(
                    secreto.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
            return java.util.HexFormat.of().formatHex(
                    mac.doFinal(cuerpo.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
