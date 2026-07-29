package com.novacrm.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Plantilla de los correos del programa.
 *
 * <p>Un correo no se puede corregir despues de enviarlo, asi que conviene fijar
 * lo que lo rompe: marcado inyectado desde un nombre, o depender de imagenes
 * que el destinatario no ha autorizado a mostrar.
 */
class PlantillaCorreoTest {

    private String correo(String titulo, String saludo, String cuerpo) {
        return PlantillaCorreo.construir(titulo, saludo, cuerpo, null, null);
    }

    @Test
    void incluyeElLemaYLosAliadosDelPrograma() {
        String html = correo("Tu acceso esta listo", "Hola Ana,", "<p>Contenido</p>");

        assertTrue(html.contains("Cuando sabes ingles se nota"));
        assertTrue(html.contains("Fundacion Santo Domingo"));
        assertTrue(html.contains("GitLab Foundation"));
        assertTrue(html.contains("CAC Eurocentres"));
        assertTrue(html.contains("Compartamos con Colombia"));
    }

    /**
     * Los clientes de correo bloquean las imagenes hasta que el destinatario
     * las autoriza. Si el lema solo estuviera en el banner, el correo llegaria
     * sin identidad ninguna.
     */
    @Test
    void seEntiendeAunqueNoSeMuestrenLasImagenes() {
        String sinBanner = PlantillaCorreo.construir("Titulo", "Hola,", "<p>Cuerpo</p>", null, null);

        assertFalse(sinBanner.contains("<img"), "sin banner no debe haber imagenes");
        assertTrue(sinBanner.contains("Cuando sabes ingles se nota"),
                "el lema debe ir tambien como texto");
        assertTrue(sinBanner.contains("Titulo"));
    }

    @Test
    void incluyeElLogoYElBannerCuandoSeConfiguran() {
        String html = PlantillaCorreo.construir("Titulo", "Hola,", "<p>Cuerpo</p>",
                "https://cdn.ejemplo.com/logo.png", "https://cdn.ejemplo.com/banner.png");

        assertTrue(html.contains("https://cdn.ejemplo.com/logo.png"), "falta el logo de cabecera");
        assertTrue(html.contains("https://cdn.ejemplo.com/banner.png"), "falta el banner del pie");
    }

    /**
     * El nombre viene de la base de datos. Sin escapar, un apellido con "&" o
     * "<" rompe el correo, y un campo manipulado inyectaria marcado.
     */
    @Test
    void escapaLosDatosQueVienenDeLaBase() {
        String html = correo("Titulo", "Hola <script>alert(1)</script>,", "<p>Cuerpo</p>");

        assertFalse(html.contains("<script>"), "no debe colarse marcado desde el saludo");
        assertTrue(html.contains("&lt;script&gt;"));
    }

    @Test
    void escapaLosAmpersandDeLosNombres() {
        assertEquals("Marta &amp; Luis", PlantillaCorreo.escapar("Marta & Luis"));
        assertEquals("&lt;b&gt;", PlantillaCorreo.escapar("<b>"));
        assertEquals("", PlantillaCorreo.escapar(null));
    }

    /** El cuerpo se pasa ya como HTML por quien lo compone y no se escapa. */
    @Test
    void respetaElHtmlDelCuerpo() {
        String html = correo("Titulo", "Hola,", "<p><strong>importante</strong></p>");

        assertTrue(html.contains("<strong>importante</strong>"));
    }

    @Test
    void elRecuadroMuestraElDatoDestacado() {
        String recuadro = PlantillaCorreo.recuadroDato("Tu usuario sera", "ana@ejemplo.com");

        assertTrue(recuadro.contains("ana@ejemplo.com"));
        assertTrue(recuadro.contains("Tu usuario sera"));
    }

    /** Outlook ignora el padding de los enlaces: el boton va en tabla. */
    @Test
    void elBotonSeDibujaConTablaParaQueOutlookLoRespete() {
        String boton = PlantillaCorreo.boton("Entrar", "https://panel.ejemplo.com/login");

        assertTrue(boton.contains("<table"));
        assertTrue(boton.contains("https://panel.ejemplo.com/login"));
        assertTrue(boton.contains("Entrar"));
    }

    @Test
    void llevaCodificacionYAdaptacionAMovil() {
        String html = correo("Titulo", "Hola,", "<p>Cuerpo</p>");

        assertTrue(html.contains("charset=\"UTF-8\""), "sin charset las tildes se rompen");
        assertTrue(html.contains("viewport"), "debe verse bien en el movil");
    }
}
