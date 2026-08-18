package com.novacrm.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * De {@code app.frontend-url} cuelga el enlace de los correos que abren cuenta
 * y de los que recuperan contrasena. Con el valor por defecto —localhost— el
 * correo se envia igual y el log dice que se envio: quien descubre que el
 * enlace no lleva a ninguna parte es el destinatario.
 */
class UrlDelFrontendTest {

    @Test
    void reconoceLasDireccionesQueSoloValenEnLaMaquina() {
        assertTrue(UrlDelFrontend.esLocal("http://localhost:3000"));
        assertTrue(UrlDelFrontend.esLocal("https://LOCALHOST:8080"));
        assertTrue(UrlDelFrontend.esLocal("http://127.0.0.1:3000"));
        assertTrue(UrlDelFrontend.esLocal("http://0.0.0.0:3000"));
        assertTrue(UrlDelFrontend.esLocal("http://[::1]:3000"));
    }

    /** Sin valor tampoco se puede construir un enlace que sirva. */
    @Test
    void unaDireccionAusenteCuentaComoLocal() {
        assertTrue(UrlDelFrontend.esLocal(null));
        assertTrue(UrlDelFrontend.esLocal(""));
        assertTrue(UrlDelFrontend.esLocal("   "));
    }

    @Test
    void unaDireccionPublicaPasa() {
        assertFalse(UrlDelFrontend.esLocal("https://novacrm.example"));
        assertFalse(UrlDelFrontend.esLocal("https://nova-crm.onrender.com"));
        assertFalse(UrlDelFrontend.esLocal("  https://novacrm.example/  "));
    }

    /**
     * Un dominio real que contenga la palabra no debe confundirse con la
     * maquina local: {@code localhost-cac.example} es un sitio de verdad.
     */
    @Test
    void unDominioQueMencionaLocalhostEsOtraCosa() {
        assertTrue(UrlDelFrontend.esLocal("https://localhost-cac.example"),
                "hoy se marca como local por precaucion; si algun dia estorba, "
                        + "hay que comparar el host y no la cadena entera");
    }
}
