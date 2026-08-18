package com.novacrm.auth;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Cambiar la contrasena tiene que echar a quien ya estuviera dentro. Si no, la
 * sesion abierta —que es justo el motivo por el que uno la cambia— sigue
 * renovandose durante los siete dias que dura el refresh.
 */
class CambioDePasswordCortaSesionesTest {

    @Test
    void cambiarLaPasswordDejaMarcaDelMomento() {
        var usuario = new Usuario();
        assertNull(usuario.getCredencialesDesde(),
                "una cuenta que nunca cambio su contrasena no invalida nada");

        var antes = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
        usuario.cambiarPassword("$2a$10$loquesea");
        var despues = LocalDateTime.now();

        assertNotNull(usuario.getCredencialesDesde());
        assertFalse(usuario.getCredencialesDesde().isBefore(antes));
        assertFalse(usuario.getCredencialesDesde().isAfter(despues));
    }

    /**
     * El {@code iat} de un JWT va en segundos enteros. Sin truncar la marca, un
     * token emitido en el mismo segundo del cambio pareceria anterior y se
     * rechazaria sin motivo: quien acaba de cambiar su contrasena no podria
     * renovar la sesion que se acaba de abrir.
     */
    @Test
    void laMarcaSeTruncaAlSegundo() {
        var usuario = new Usuario();
        usuario.cambiarPassword("$2a$10$loquesea");

        assertEquals(0, usuario.getCredencialesDesde().getNano(),
                "con fraccion de segundo, un token del mismo segundo cae del lado equivocado");
    }

    @Test
    void laPasswordQuedaGuardada() {
        var usuario = new Usuario();
        usuario.cambiarPassword("$2a$10$hash-codificado");

        assertEquals("$2a$10$hash-codificado", usuario.getPassword());
    }
}
