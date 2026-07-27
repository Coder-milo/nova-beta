package com.novacrm.matching;

import com.novacrm.catalogo.nivel_ingles.NivelIngles;
import com.novacrm.config.MatchingConfig;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/**
 * Puntuacion del ajuste de ingles.
 *
 * <p>El caso que motiva estas pruebas es real: en la primera cohorte, 89 de 102
 * participantes declararon mas nivel del que midieron sus pruebas, y el 81%
 * quedo en A1 oral pese a que 71 de 108 aspiran a BPO, que es trabajo de voz.
 * Puntuar con el nivel declarado recomendaba esas vacantes igualmente.
 */
class PuntajeInglesTest {

    private static final int PESO_INGLES = 30;

    private MatchingService matchingService;
    private MatchingConfig config;

    @BeforeEach
    void configurar() {
        config = new MatchingConfig();
        ReflectionTestUtils.setField(config, "pesoIngles", PESO_INGLES);

        // Solo se ejercita puntajeIngles, que no usa las dependencias.
        matchingService = mock(MatchingService.class,
                org.mockito.Mockito.withSettings().defaultAnswer(
                        org.mockito.Mockito.CALLS_REAL_METHODS));
    }

    private Estudiante estudiante(String declarado, String pruebaEscrita, String pruebaOral) {
        var e = new Estudiante();
        if (declarado != null) {
            var nivel = new NivelIngles();
            nivel.setCodigo(declarado);
            nivel.setNombre(declarado);
            nivel.setOrden(0);
            e.setNivelIngles(nivel);
        }
        e.setResultadoPruebaEscrita(pruebaEscrita);
        e.setResultadoPruebaOral(pruebaOral);
        return e;
    }

    private Vacante vacante(String titulo, String nivelRequerido) {
        var v = new Vacante();
        v.setTitulo(titulo);
        v.setNivelInglesRequerido(nivelRequerido);
        return v;
    }

    private double puntuar(Estudiante e, Vacante v) {
        return matchingService.puntajeIngles(e, v, config);
    }

    /**
     * El caso central: declara B1, pero la prueba oral lo situa en A1, y la
     * vacante es de voz. Antes puntuaba al maximo.
     */
    @Test
    void unA1OralNoPuntuaAltoEnUnaVacanteDeVozQueExigeB1() {
        var candidato = estudiante("B1", "B1", "A1+");
        var vacanteDeVoz = vacante("Bilingual Customer Service Representative", "B1");

        double puntaje = puntuar(candidato, vacanteDeVoz);

        assertTrue(puntaje < PESO_INGLES * 0.5,
                () -> "un A1 oral no deberia acercarse al maximo en una vacante de voz, fue " + puntaje);
    }

    @Test
    void quienSiTieneElOralMedidoPuntuaAlMaximo() {
        var candidato = estudiante("B1", "B1", "B1");
        var vacanteDeVoz = vacante("Bilingual Call Center Agent", "B1");

        assertEquals(PESO_INGLES, puntuar(candidato, vacanteDeVoz), 0.001);
    }

    /**
     * Dos candidatos que declaran lo mismo deben separarse por lo que miden sus
     * pruebas: ese es el efecto buscado del cambio.
     */
    @Test
    void separaADosCandidatosQueDeclaranLoMismo() {
        var vacanteDeVoz = vacante("Agente bilingue inbound", "B1");

        double conOralBueno = puntuar(estudiante("B1", "B1", "B1"), vacanteDeVoz);
        double conOralBajo = puntuar(estudiante("B1", "B1", "A1+"), vacanteDeVoz);

        assertTrue(conOralBueno > conOralBajo,
                "el nivel declarado es el mismo; debe decidir el medido");
    }

    /** En vacantes que no son de voz manda la destreza mas floja de las medidas. */
    @Test
    void enVacanteEscritaSeUsaElMenorDeLosNivelesMedidos() {
        var candidato = estudiante("B1", "B1", "A1+");
        var vacanteEscrita = vacante("Data Entry Assistant", "B1");

        double puntaje = puntuar(candidato, vacanteEscrita);

        assertEquals(PESO_INGLES * (1.0 / 3.0), puntaje, 0.001,
                "el desempeno lo limita la destreza mas floja (A1 sobre B1 requerido)");
    }

    @Test
    void unaVacanteSinExigenciaDeInglesNoPenalizaANadie() {
        var candidato = estudiante("A2", "A1+", "A1+");
        var vacante = vacante("Auxiliar de bodega", null);

        assertEquals(PESO_INGLES, puntuar(candidato, vacante), 0.001);
    }

    /**
     * Sin pruebas solo queda lo declarado: se usa, pero para una vacante de voz
     * sigue siendo el unico dato disponible.
     */
    @Test
    void sinPruebasSeUsaElNivelDeclarado() {
        var candidato = estudiante("B1", null, null);
        var vacanteDeVoz = vacante("Customer service bilingue", "B1");

        assertEquals(PESO_INGLES, puntuar(candidato, vacanteDeVoz), 0.001);
    }

    /**
     * Quien no tiene ni pruebas ni nivel declarado no debe puntuar como si
     * cumpliera, ni como si fallara: no hay informacion.
     */
    @Test
    void sinNingunDatoPuntuaALaMitad() {
        var candidato = estudiante(null, null, null);
        var vacanteDeVoz = vacante("Bilingual agent", "B1");

        assertEquals(PESO_INGLES * 0.5, puntuar(candidato, vacanteDeVoz), 0.001);
    }

    /**
     * Si la vacante es de voz y solo se midio el escrito, no se sustituye por
     * el: son destrezas distintas.
     */
    @Test
    void enVacanteDeVozElEscritoNoSustituyeAlOral() {
        var candidato = estudiante("A2", "B1", null);
        var vacanteDeVoz = vacante("Teleoperador bilingue", "B1");

        assertEquals(PESO_INGLES * (2.0 / 3.0), puntuar(candidato, vacanteDeVoz), 0.001,
                "debe caer al declarado A2, no aprovechar el B1 escrito");
    }
}
