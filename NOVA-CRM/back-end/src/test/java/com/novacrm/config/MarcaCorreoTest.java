package com.novacrm.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Como se traducen las medidas del archivo a las del correo.
 *
 * <p>Lo que se protege aqui es que el HTML lleve {@code width} y {@code height}
 * escritos y coherentes: Outlook no calcula el tamano a partir del CSS, usa
 * esos atributos, y si faltan dibuja la imagen al tamano del archivo. Como las
 * imagenes se piden al doble de resolucion, eso saldria al doble de grande.
 */
class MarcaCorreoTest {

    private MarcaCorreo conCabecera(int ancho, int alto) {
        return new MarcaCorreo("http://x/h.png", ancho, alto, null, null, null, null, null);
    }

    @Test
    void unaImagenAlDobleSeMuestraALaMitad() {
        var marca = conCabecera(1200, 400);

        assertEquals(600, marca.anchoLogoVisible());
        assertEquals(400 / 2, marca.altoLogoVisible());
    }

    @Test
    void seRespetaLaProporcionAunqueNoSeaLaEsperada() {
        var marca = conCabecera(900, 300);

        assertEquals(450, marca.anchoLogoVisible());
        assertEquals(150, marca.altoLogoVisible(),
                "el alto tiene que seguir al ancho o la imagen sale deformada");
    }

    @Test
    void nuncaSeSuperaElAnchoQueRespetaOutlook() {
        var marca = conCabecera(4000, 1000);

        assertEquals(MarcaCorreo.ANCHO_CORREO, marca.anchoLogoVisible(),
                "mas de 600 px y Outlook recorta el mensaje");
    }

    @Test
    void sinMedidasSeOmiteElAltoEnVezDeInventarlo() {
        var marca = MarcaCorreo.global("http://x/logo.png", "http://x/pie.png");

        assertNull(marca.altoLogoVisible(), "un alto inventado deformaria la imagen");
        assertNull(marca.altoBannerVisible());
        assertTrue(marca.anchoLogoVisible() > 0, "el ancho si tiene un valor por defecto sensato");
    }

    @Test
    void elHtmlLlevaLasMedidasEscritas() {
        var marca = new MarcaCorreo(
                "http://x/h.png", 1200, 400,
                "http://x/p.png", 1200, 300,
                null, "#FF6600");

        String html = PlantillaCorreo.construir("T", "Hola,", "<p>Cuerpo</p>", marca);

        assertTrue(html.contains("width=\"600\""), "falta el ancho de la cabecera");
        assertTrue(html.contains("height=\"200\""), "falta el alto de la cabecera (400/2)");
        assertTrue(html.contains("height=\"150\""), "falta el alto del pie (300/2)");
    }

    @Test
    void elColorDelProgramaLlegaAlBoton() {
        String html = PlantillaCorreo.boton("Ir", "http://x", "#FF6600");

        assertTrue(html.contains("#FF6600"),
                "el boton se arma antes de envolver el correo, asi que hay que decirle el color");
    }

    @Test
    void elTextoDelBotonSeLeeSobreCualquierFondo() {
        // Sobre un amarillo claro, el blanco de siempre dejaba el boton
        // ilegible; y el boton es lo que hay que pulsar para poder entrar.
        assertEquals("#101828", PlantillaCorreo.textoSobre("#FFE066"));
        assertEquals("#FFFFFF", PlantillaCorreo.textoSobre("#1268E8"));
        assertEquals("#FFFFFF", PlantillaCorreo.textoSobre(null), "sin color, el de siempre");
    }

    @Test
    void unProgramaSinPersonalizarSigueMandandoUnCorreoPresentable() {
        String html = PlantillaCorreo.construir("T", "Hola,", "<p>Cuerpo</p>",
                MarcaCorreo.global(null, null));

        // Sin imagenes, el lema y los aliados van como texto: es el compromiso
        // con las entidades que financian el programa.
        assertTrue(html.contains("Cuando sabes ingles se nota"));
        assertTrue(html.contains("Fundacion Santo Domingo"));
    }

    @Test
    void elTextoDePieDelProgramaSustituyeAlDeLosAliados() {
        var marca = new MarcaCorreo(null, null, null, null, null, null,
                "Ruta Accelerator · Barranquilla", null);

        String html = PlantillaCorreo.construir("T", "Hola,", "<p>x</p>", marca);

        assertTrue(html.contains("Ruta Accelerator"));
        assertFalse(html.contains("Fundacion Santo Domingo"),
                "si el programa pone su propio pie, no se apilan los dos");
    }
}
