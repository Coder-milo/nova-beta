package com.novacrm.catalogo.nivel_ingles;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Lectura del nivel MCER desde los textos reales del programa: los resultados
 * de las pruebas ("A2+", "A1+") y el nivel declarado en el formulario de
 * admision ("B1 (Puedo comunicarme en situaciones sencillas)").
 */
class NivelMcerTest {

    @ParameterizedTest
    @CsvSource({
            // Resultados de las pruebas, tal cual vienen en la hoja.
            "A1+, A1",
            "A2+, A2",
            "A2, A2",
            "B1, B1",
            // Nivel declarado en el formulario.
            "'B1 (Puedo comunicarme en situaciones sencillas)', B1",
            "'A2 (Entiendo frases y expresiones basicas)', A2",
            "'B2 o superior', B2",
            // Variaciones de escritura.
            "'  b1  ', B1",
            "'Nivel C1 avanzado', C1",
    })
    void leeElNivelDeLosTextosDelPrograma(String texto, NivelMcer esperado) {
        assertEquals(Optional.of(esperado), NivelMcer.desdeTexto(texto));
    }

    /** El "+" indica progreso dentro del nivel, no que se alcance el siguiente. */
    @Test
    void elSufijoMasNoSubeDeNivel() {
        assertEquals(Optional.of(NivelMcer.A2), NivelMcer.desdeTexto("A2+"));
        assertTrue(NivelMcer.A2.getOrden() < NivelMcer.B1.getOrden(),
                "un A2+ no debe alcanzar a un B1");
    }

    @ParameterizedTest
    @ValueSource(strings = {"No estoy seguro/a", "", "   ", "pendiente", "N/A"})
    void devuelveVacioCuandoNoHayNivelReconocible(String texto) {
        assertEquals(Optional.empty(), NivelMcer.desdeTexto(texto));
    }

    @Test
    void devuelveVacioAnteNulo() {
        assertEquals(Optional.empty(), NivelMcer.desdeTexto(null));
    }

    /** No debe confundir un codigo con una subcadena de otra palabra. */
    @Test
    void noConfundeCodigosDentroDeOtrasPalabras() {
        assertEquals(Optional.empty(), NivelMcer.desdeTexto("CLASEA1B"));
        assertEquals(Optional.empty(), NivelMcer.desdeTexto("SALON-A1B2C"));
    }

    @Test
    void elOrdenSigueLaEscalaMcer() {
        assertTrue(NivelMcer.A1.getOrden() < NivelMcer.A2.getOrden());
        assertTrue(NivelMcer.A2.getOrden() < NivelMcer.B1.getOrden());
        assertTrue(NivelMcer.B1.getOrden() < NivelMcer.B2.getOrden());
        assertTrue(NivelMcer.B2.getOrden() < NivelMcer.C1.getOrden());
        assertTrue(NivelMcer.C1.getOrden() < NivelMcer.C2.getOrden());
    }

    @Test
    void elMenorDeDosNivelesIgnoraLosAusentes() {
        assertEquals(Optional.of(NivelMcer.A1),
                NivelMcer.menor(Optional.of(NivelMcer.B1), Optional.of(NivelMcer.A1)));
        assertEquals(Optional.of(NivelMcer.B1),
                NivelMcer.menor(Optional.of(NivelMcer.B1), Optional.empty()));
        assertEquals(Optional.of(NivelMcer.A2),
                NivelMcer.menor(Optional.empty(), Optional.of(NivelMcer.A2)));
        assertEquals(Optional.empty(),
                NivelMcer.menor(Optional.empty(), Optional.empty()));
    }
}
