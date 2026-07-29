package com.novacrm.excel;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Respuestas de si/no tal y como llegan del formulario de admision.
 *
 * <p>Las opciones del formulario son frases, no monosilabos. Cuando la
 * interpretacion exigia la cadena exacta "si"/"no", se perdian en silencio el
 * 100% de las respuestas de "tienes computador" y "te interesaria migrar":
 * quedaban en null sin registrar ningun error de importacion.
 */
class RespuestasSiNoTest {

    @ParameterizedTest
    @ValueSource(strings = {
            // Valores textuales reales del formulario (pregunta 7.3).
            "Sí, propio",
            "Sí, tengo acceso a un computador prestado",
            // Pregunta 9.1.
            "Sí, me interesa y estoy dispuesto(a) a viajar",
            // Pregunta 7.4 y variantes de escritura.
            "Si",
            "SI",
            "sí",
            "Sí",
            "  Si  ",
            "yes",
            "1"
    })
    void reconoceLasAfirmaciones(String respuesta) {
        assertEquals(Boolean.TRUE, ExcelService.parseBoolean(respuesta),
                () -> "deberia interpretarse como afirmacion: " + respuesta);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "No",
            "NO",
            "no",
            "No tengo la posibilidad de asumir los gastos",
            "No aplica (No estoy trabajando actualmente)",
            "false",
            "0"
    })
    void reconoceLasNegaciones(String respuesta) {
        assertEquals(Boolean.FALSE, ExcelService.parseBoolean(respuesta),
                () -> "deberia interpretarse como negacion: " + respuesta);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "Prefiero no responder", "Tal vez", "Ninguno"})
    void dejaEnNuloLoQueNoEsUnaRespuestaSiNo(String respuesta) {
        assertNull(ExcelService.parseBoolean(respuesta),
                () -> "no deberia inventar un valor para: " + respuesta);
    }

    /**
     * "N/A" aparece en varias columnas del formulario y significa "sin dato".
     * Al partir por caracteres no alfanumericos su primera palabra es "n", asi
     * que aceptar iniciales sueltas lo convertiria en una negacion falsa.
     */
    @ParameterizedTest
    @ValueSource(strings = {"N/A", "n/a", "N.A.", "s"})
    void noTrataLasInicialesSueltasComoRespuesta(String respuesta) {
        assertNull(ExcelService.parseBoolean(respuesta),
                () -> "no deberia interpretarse como si/no: " + respuesta);
    }

    @Test
    void unNuloSigueSiendoNulo() {
        assertNull(ExcelService.parseBoolean(null));
    }

    /**
     * "Prefiero no responder" empieza por "prefiero", no por "no": no debe
     * confundirse con una negacion solo porque contenga la palabra.
     */
    @Test
    void noConfundeUnaNegacionEnMitadDeLaFrase() {
        assertNull(ExcelService.parseBoolean("Prefiero no responder"));
    }
}
