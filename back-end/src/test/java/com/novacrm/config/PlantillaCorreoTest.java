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

        assertTrue(html.contains("Programa de Formación y Empleabilidad"));
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
        assertTrue(sinBanner.contains("Programa de Formación y Empleabilidad"),
                "el titulo o lema institucional debe ir tambien como texto");
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
        assertTrue(html.contains("max-width:100%"), "debe ajustarse al 100% en pantallas móviles");
        assertTrue(html.contains("width=\"600\""), "debe fijar ancho de 600px para escritorio");
    }

    @Test
    void badgeGeneraInsigniaPillConEstilosCorrectos() {
        String badge = PlantillaCorreo.badge("Remoto 100%", "#ECFDF5", "#047857");

        assertTrue(badge.contains("Remoto 100%"));
        assertTrue(badge.contains("background-color:#ECFDF5"));
        assertTrue(badge.contains("color:#047857"));
        assertTrue(badge.contains("border-radius:12px"));

        // Comportamiento con valores nulos
        assertEquals("", PlantillaCorreo.badge(null, null, null));
        assertEquals("", PlantillaCorreo.badge("   ", null, null));

        String badgeDefault = PlantillaCorreo.badge("Afinidad", null, null);
        assertTrue(badgeDefault.contains("Afinidad"));
        assertTrue(badgeDefault.contains("background-color:#EEF2F6"));
    }

    @Test
    void tarjetaInformativaRenderizaTituloYCuerpoConBordeAcentuado() {
        String tarjeta = PlantillaCorreo.tarjetaInformativa("Consejos", "<p>Llega puntual</p>", "#10B981");

        assertTrue(tarjeta.contains("<table"));
        assertTrue(tarjeta.contains("Consejos"));
        assertTrue(tarjeta.contains("Llega puntual"));
        assertTrue(tarjeta.contains("border-left:4px solid #10B981"));

        // Sin título
        String sinTitulo = PlantillaCorreo.tarjetaInformativa(null, "<p>Solo contenido</p>", null);
        assertTrue(sinTitulo.contains("Solo contenido"));
        assertTrue(sinTitulo.contains("border-left:4px solid #1B6DF5"));
    }

    @Test
    void barraProgresoRenderizaPorcentajeAjustado() {
        String barra = PlantillaCorreo.barraProgreso(75, "#1B6DF5");

        assertTrue(barra.contains("75%"));
        assertTrue(barra.contains("width=\"75%\""));
        assertTrue(barra.contains("background-color:#1B6DF5"));

        // Clamping inferior (<0 -> 0%)
        String barraMin = PlantillaCorreo.barraProgreso(-10, null);
        assertTrue(barraMin.contains("0%"));
        assertTrue(barraMin.contains("width=\"0%\""));

        // Clamping superior (>100 -> 100%)
        String barraMax = PlantillaCorreo.barraProgreso(150, null);
        assertTrue(barraMax.contains("100%"));
        assertTrue(barraMax.contains("width=\"100%\""));
    }

    @Test
    void contrastesWcagAaCalculaTextoLegibleSegunFondo() {
        // Fondos claros deben devolver texto oscuro legible (#101828)
        assertEquals("#101828", PlantillaCorreo.textoSobre("#FFFFFF"));
        assertEquals("#101828", PlantillaCorreo.textoSobre("#FFFF00")); // Amarillo brillante
        assertEquals("#101828", PlantillaCorreo.textoSobre("#ECFDF5")); // Verde muy claro
        assertEquals("#101828", PlantillaCorreo.textoSobre("#FEF3C7")); // Ámbar muy claro
        assertEquals("#101828", PlantillaCorreo.textoSobre("#E2E8F0")); // Gris claro

        // Fondos oscuros deben devolver texto blanco (#FFFFFF)
        assertEquals("#FFFFFF", PlantillaCorreo.textoSobre("#000000"));
        assertEquals("#FFFFFF", PlantillaCorreo.textoSobre("#1F2A44")); // Azul oscuro institucional
        assertEquals("#FFFFFF", PlantillaCorreo.textoSobre("#1B6DF5")); // Azul institucional
        assertEquals("#FFFFFF", PlantillaCorreo.textoSobre("#1D4ED8")); // Azul oscuro

        // Resiliencia ante hex de 3 caracteres y nulos
        assertEquals("#101828", PlantillaCorreo.textoSobre("#FFF"));
        assertEquals("#FFFFFF", PlantillaCorreo.textoSobre("#000"));
        assertEquals("#FFFFFF", PlantillaCorreo.textoSobre(null));
        assertEquals("#FFFFFF", PlantillaCorreo.textoSobre("invalido"));
    }

    @Test
    void cabeceraEscalaDimensionesRetinaConAtributosHtml() {
        MarcaCorreo marcaRetina = new MarcaCorreo(
                "https://cdn.ejemplo.com/logo.png", 520, 160,
                "https://cdn.ejemplo.com/pie.png", 1200, 200,
                "Aliados", "#1B6DF5");

        String html = PlantillaCorreo.construir("Titulo", "Saludo", "<p>Cuerpo</p>", marcaRetina);

        // Logo: 520/2 = 260px ancho visible, 160*260/520 = 80px alto visible
        assertTrue(html.contains("width=\"260\""), "logo debe tener width=260");
        assertTrue(html.contains("height=\"80\""), "logo debe tener height=80");
        assertTrue(html.contains("alt=\"Programa de Formación y Empleabilidad\""), "logo debe tener alt");

        // Banner: 1200/2 = 600px ancho visible, 200*600/1200 = 100px alto visible
        assertTrue(html.contains("width=\"600\""), "banner debe tener width=600");
        assertTrue(html.contains("height=\"100\""), "banner debe tener height=100");
    }
}
