package com.novacrm.vacante;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Validacion del destino antes de descargar una oferta (SSRF).
 *
 * <p>La URL la escribe un usuario y la descarga el servidor: solo deben
 * aceptarse portales publicos http/https. Cualquier esquema distinto o
 * cualquier host interno —loopback, privado, enlace local— se rechaza.
 */
class LectorDeOfertaValidacionUrlTest {

    @Test
    void aceptaUnaUrlPublica() throws Exception {
        assertEquals("https://ejemplo.com/oferta/1",
                LectorDeOferta.validar("https://ejemplo.com/oferta/1"));
    }

    @Test
    void rechazaEsquemasQueNoSeanHttp() {
        assertThrows(IllegalArgumentException.class,
                () -> LectorDeOferta.validar("file:///etc/passwd"));
        assertThrows(IllegalArgumentException.class,
                () -> LectorDeOferta.validar("ftp://ejemplo.com/oferta"));
        assertThrows(IllegalArgumentException.class,
                () -> LectorDeOferta.validar("javascript:alert(1)"));
    }

    @Test
    void rechazaHostsInternos() {
        assertThrows(IllegalArgumentException.class,
                () -> LectorDeOferta.validar("http://127.0.0.1:8080/"));
        assertThrows(IllegalArgumentException.class,
                () -> LectorDeOferta.validar("http://localhost/"));
        assertThrows(IllegalArgumentException.class,
                () -> LectorDeOferta.validar("http://10.0.0.5/"));
        assertThrows(IllegalArgumentException.class,
                () -> LectorDeOferta.validar("http://192.168.1.10/"));
        assertThrows(IllegalArgumentException.class,
                () -> LectorDeOferta.validar("http://169.254.169.254/latest/meta-data/"));
    }

    @Test
    void rechazaUrlSinHost() {
        assertThrows(IllegalArgumentException.class,
                () -> LectorDeOferta.validar("http://"));
    }
}
