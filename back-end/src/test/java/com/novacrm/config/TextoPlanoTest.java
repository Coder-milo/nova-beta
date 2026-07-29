package com.novacrm.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Version en texto plano del correo.
 *
 * <p>Lo que de verdad se prueba aqui es que el enlace de activacion sobreviva:
 * si se pierde, quien lea el correo sin HTML no puede entrar al panel.
 */
class TextoPlanoTest {

    @Test
    void elEnlaceSobreviveConSuUrl() {
        String html = PlantillaCorreo.boton("Crear mi contrasena",
                "http://localhost:3000/recuperar-contrasena?token=abc123");

        String texto = TextoPlano.deHtml(html);

        assertTrue(texto.contains("Crear mi contrasena"), "el texto del boton");
        assertTrue(texto.contains("http://localhost:3000/recuperar-contrasena?token=abc123"),
                "sin la URL el correo no sirve para nada");
    }

    @Test
    void noQuedaNingunaEtiqueta() {
        String html = PlantillaCorreo.construir(
                "Activa tu acceso",
                "Hola Hector,",
                "<p>Primer parrafo.</p><p>Segundo parrafo.</p>",
                "http://ejemplo.com/logo.png",
                "http://ejemplo.com/pie.png");

        String texto = TextoPlano.deHtml(html);

        assertFalse(texto.contains("<"), "quedaron etiquetas: " + texto);
        assertFalse(texto.contains(">"), "quedaron etiquetas: " + texto);
        assertTrue(texto.contains("Primer parrafo."));
        assertTrue(texto.contains("Segundo parrafo."));
    }

    @Test
    void elCssNoAcabaEnElCuerpoDelMensaje() {
        String html = "<html><head><style>body{color:red}</style></head>"
                + "<body><p>Hola</p></body></html>";

        String texto = TextoPlano.deHtml(html);

        assertEquals("Hola", texto);
    }

    @Test
    void lasEntidadesSeLeenComoCaracteres() {
        String texto = TextoPlano.deHtml(
                "<p>Pide uno desde &laquo;Olvide mi contrasena&raquo; &amp; listo</p>");

        assertEquals("Pide uno desde «Olvide mi contrasena» & listo", texto);
    }

    @Test
    void cadaParrafoQuedaEnSuLinea() {
        String texto = TextoPlano.deHtml("<p>Uno</p><p>Dos</p><br><p>Tres</p>");

        // Sin los saltos, los parrafos se pegarian en "UnoDosTres".
        assertEquals("Uno\nDos\n\nTres", texto);
    }

    @Test
    void elSaludoNoSaleDosVecesPorElPreheaderOculto() {
        String html = PlantillaCorreo.construir(
                "Activa tu acceso", "Hola Hector,", "<p>Cuerpo.</p>", "", "");

        String texto = TextoPlano.deHtml(html);

        // El preheader es el resumen invisible que los clientes muestran junto
        // al asunto, y repite el saludo. En texto plano no debe aparecer.
        assertEquals(1, texto.split("Hola Hector,", -1).length - 1,
                "el saludo aparece repetido:\n" + texto);
    }

    @Test
    void unHtmlVacioNoRevienta() {
        assertEquals("", TextoPlano.deHtml(null));
        assertEquals("", TextoPlano.deHtml("   "));
    }
}
