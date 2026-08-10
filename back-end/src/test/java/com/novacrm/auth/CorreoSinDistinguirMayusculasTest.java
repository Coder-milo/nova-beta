package com.novacrm.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * El correo se guardaba tal cual se escribiera y se buscaba con igualdad
 * exacta, mientras que la ficha del estudiante se busca sin distinguir
 * mayusculas. La misma persona era dos cosas distintas segun la mitad del
 * sistema, y en un movil que pone la primera letra en mayuscula por su cuenta
 * eso se vive como "mi correo no existe".
 */
class CorreoSinDistinguirMayusculasTest {

    @Test
    void seGuardaEnMinusculas() {
        var usuario = new Usuario();
        usuario.setEmail("Hector.Suarez@Ejemplo.COM");

        assertEquals("hector.suarez@ejemplo.com", usuario.getEmail());
    }

    /** Un correo copiado de una hoja de calculo suele traer espacios. */
    @Test
    void seQuitanLosEspaciosDeLosExtremos() {
        var usuario = new Usuario();
        usuario.setEmail("  ana@ejemplo.com \n");

        assertEquals("ana@ejemplo.com", usuario.getEmail());
    }

    @Test
    void unCorreoAusenteSigueSiendoAusente() {
        var usuario = new Usuario();
        usuario.setEmail(null);

        assertNull(usuario.getEmail());
    }

    /**
     * Con la configuracion regional turca, {@code "I"} en minuscula no es
     * {@code "i"}: un servidor asi dejaria fuera a quien tuviera una I en el
     * correo. Por eso la normalizacion usa {@code Locale.ROOT}.
     */
    @Test
    void laIMayusculaBajaAILatinaSiempre() {
        var anterior = java.util.Locale.getDefault();
        try {
            java.util.Locale.setDefault(java.util.Locale.forLanguageTag("tr"));
            var usuario = new Usuario();
            usuario.setEmail("IRIS@EJEMPLO.COM");

            assertEquals("iris@ejemplo.com", usuario.getEmail());
        } finally {
            java.util.Locale.setDefault(anterior);
        }
    }
}
