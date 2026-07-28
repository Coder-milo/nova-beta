package com.novacrm.correo;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Sustitucion de variables en las plantillas de correo.
 *
 * <p>Lo que se protege aqui llega a la bandeja de 108 personas: un valor sin
 * escapar rompe el HTML del mensaje y una marca mal escrita se lee tal cual en
 * medio de la frase.
 */
class VariablesTest {

    @Test
    void sustituyeLasMarcasPorSusValores() {
        String texto = Variables.aplicar("Hola {{nombre}}, tu usuario es {{email}}",
                Map.of(Variables.NOMBRE, "Hector", Variables.EMAIL, "hector@x.com"));

        assertEquals("Hola Hector, tu usuario es hector@x.com", texto);
    }

    @Test
    void aceptaEspaciosYMayusculasEnLaMarca() {
        String texto = Variables.aplicar("Hola {{ Nombre }}", Map.of(Variables.NOMBRE, "Ana"));

        assertEquals("Hola Ana", texto);
    }

    /**
     * Los nombres vienen de una importacion de Excel con datos reales. Uno con
     * un `&` rompe el HTML del correo si se mete tal cual.
     */
    @Test
    void escapaLosValoresParaNoRomperElHtml() {
        String texto = Variables.aplicar("Hola {{nombre}}",
                Map.of(Variables.NOMBRE, "Ana & <script>alert(1)</script>"));

        assertFalse(texto.contains("<script>"), "no puede colarse etiqueta: " + texto);
        assertTrue(texto.contains("&amp;"));
        assertTrue(texto.contains("&lt;script&gt;"));
    }

    @Test
    void unaVariableSinValorDejaHuecoYNoSuMarca() {
        String texto = Variables.aplicar("Vacante en {{empresa}}.", Map.of());

        assertEquals("Vacante en .", texto);
        assertFalse(texto.contains("{{"), "el destinatario no debe ver la marca");
    }

    @Test
    void unaMarcaDesconocidaNoLlegaAlDestinatario() {
        String texto = Variables.aplicar("Hola {{nombrre}}", Map.of(Variables.NOMBRE, "Ana"));

        assertFalse(texto.contains("{{"), "una errata no puede salir impresa: " + texto);
    }

    @Test
    void seDetectanLasMarcasMalEscritasParaAvisarAlGuardar() {
        var malas = Variables.desconocidasEn("Hola {{nombre}}, {{nombrre}} y {{empressa}}");

        assertEquals(java.util.List.of("nombrre", "empressa"), malas);
    }

    @Test
    void seSabeQueVariablesUsaUnaPlantilla() {
        var usadas = Variables.usadasEn("Hola {{nombre}}, vacante en {{empresa}}. {{nombre}} otra vez.");

        assertEquals(java.util.List.of(Variables.NOMBRE, Variables.EMPRESA), usadas,
                "en orden de aparicion y sin repetir");
    }

    /**
     * Saber si una plantilla usa {{empresa}} importa antes de enviar: en un
     * envio masivo a estudiantes no hay ninguna vacante detras y esa frase
     * quedaria coja.
     */
    @Test
    void unaPlantillaSinEmpresaNoLaPideYUnaConEmpresaSi() {
        assertFalse(Variables.usadasEn("Hola {{nombre}}").contains(Variables.EMPRESA));
        assertTrue(Variables.usadasEn("Vacante en {{empresa}}").contains(Variables.EMPRESA));
    }

    @Test
    void unTextoSinMarcasSaleIgual() {
        assertEquals("Sin variables aqui.", Variables.aplicar("Sin variables aqui.", Map.of()));
    }

    @Test
    void nullNoRevienta() {
        assertEquals("", Variables.aplicar(null, Map.of()));
        assertTrue(Variables.usadasEn(null).isEmpty());
        assertTrue(Variables.desconocidasEn(null).isEmpty());
    }

    @Test
    void cadaVariableSeDocumentaSolaParaLaAyudaDelEditor() {
        for (var v : Variables.values()) {
            assertFalse(v.descripcion().isBlank(), v + " sin descripcion");
            assertFalse(v.ejemplo().isBlank(), v + " sin ejemplo para la previsualizacion");
            assertEquals("{{" + v.clave() + "}}", v.marca());
        }
    }

    @Test
    void losEjemplosCubrenTodasLasVariables() {
        // Si se anade una variable y se olvida su ejemplo, la previsualizacion
        // saldria con un hueco y nadie sabria por que.
        assertEquals(Variables.values().length, Variables.ejemplos().size());
    }
}
