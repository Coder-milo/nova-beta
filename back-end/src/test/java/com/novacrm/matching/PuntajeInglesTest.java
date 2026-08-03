package com.novacrm.matching;

import com.novacrm.catalogo.nivel_ingles.NivelIngles;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/**
 * Ajuste de ingles entre estudiante y vacante.
 *
 * <p>El caso que motiva estas pruebas es real: en la primera cohorte, 89 de 102
 * participantes declararon mas nivel del que midieron sus pruebas, y el 81%
 * quedo en A1 oral pese a que 71 de 108 aspiran a BPO, que es trabajo de voz.
 * Puntuar con el nivel declarado recomendaba esas vacantes igualmente.
 *
 * <p>El criterio devuelve un ratio de 0 a 1 —no puntos—, o {@code null} cuando
 * no hay con que juzgarlo. Ese nulo es un cambio de fondo: antes una vacante
 * que no exigia ingles repartia el peso completo a todo el mundo, asi que
 * "no se sabe" premiaba igual que "cumple".
 */
class PuntajeInglesTest {

    private MatchingService matchingService;
    private SkillSynonyms sinonimos;

    @BeforeEach
    void configurar() {
        // Solo se ejercita ratioIngles, que no toca ninguna dependencia.
        matchingService = mock(MatchingService.class,
                org.mockito.Mockito.withSettings().defaultAnswer(
                        org.mockito.Mockito.CALLS_REAL_METHODS));
        // Vocabulario real: si detectar una vacante de voz deja de funcionar al
        // tocar el yml, es aqui donde tiene que verse.
        sinonimos = new SkillSynonyms();
        sinonimos.init();
    }

    private Estudiante estudiante(String declarado, String pruebaEscrita, String pruebaOral) {
        var e = new Estudiante();
        if (declarado != null) {
            var nivel = new NivelIngles();
            nivel.setCodigo(declarado);
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

    private Double puntuar(Estudiante e, Vacante v) {
        return matchingService.ratioIngles(e, v,
                sinonimos.tokenize(v.getTitulo(), v.getDescripcion(), v.getRequisitos()));
    }

    /**
     * El caso central: declara B1, pero la prueba oral lo situa en A1, y la
     * vacante es de voz. Antes puntuaba al maximo.
     */
    @Test
    void unA1OralNoPuntuaAltoEnUnaVacanteDeVozQueExigeB1() {
        var candidato = estudiante("B1", "B1", "A1+");
        var vacanteDeVoz = vacante("Bilingual Customer Service Representative", "B1");

        Double ratio = puntuar(candidato, vacanteDeVoz);

        assertNotNull(ratio);
        assertTrue(ratio < 0.5,
                () -> "un A1 oral no deberia acercarse al maximo en una vacante de voz, fue " + ratio);
    }

    @Test
    void quienSiTieneElOralMedidoPuntuaAlMaximo() {
        var candidato = estudiante("B1", "B1", "B1");
        var vacanteDeVoz = vacante("Bilingual Call Center Agent", "B1");

        assertEquals(1.0, puntuar(candidato, vacanteDeVoz), 0.001);
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

        assertEquals(1.0 / 3.0, puntuar(candidato, vacanteEscrita), 0.001,
                "el desempeno lo limita la destreza mas floja (A1 sobre B1 requerido)");
    }

    /**
     * Una vacante que no pide ingles ya no reparte el peso completo a todo el
     * mundo: el criterio no aplica a ese par y queda fuera del reparto. Es la
     * mitad del arreglo —la otra mitad es que la vacante traiga el nivel, que
     * ahora extrae el enriquecedor—.
     */
    @Test
    void unaVacanteSinExigenciaDeInglesNoSeEvalua() {
        var candidato = estudiante("A2", "A1+", "A1+");
        var vacante = vacante("Auxiliar de bodega", null);

        assertNull(puntuar(candidato, vacante),
                "sin exigencia declarada no hay nada que comparar");
    }

    /**
     * Sin pruebas solo queda lo declarado: se usa, pero para una vacante de voz
     * sigue siendo el unico dato disponible.
     */
    @Test
    void sinPruebasSeUsaElNivelDeclarado() {
        var candidato = estudiante("B1", null, null);
        var vacanteDeVoz = vacante("Customer service bilingue", "B1");

        assertEquals(1.0, puntuar(candidato, vacanteDeVoz), 0.001);
    }

    /**
     * Quien no tiene ni pruebas ni nivel declarado no puntua como si cumpliera
     * ni como si fallara: no hay informacion, asi que el criterio no cuenta.
     */
    @Test
    void sinNingunDatoDelEstudianteNoSeEvalua() {
        var candidato = estudiante(null, null, null);
        var vacanteDeVoz = vacante("Bilingual agent", "B1");

        assertNull(puntuar(candidato, vacanteDeVoz));
    }

    /**
     * Si la vacante es de voz y solo se midio el escrito, no se sustituye por
     * el: son destrezas distintas.
     */
    @Test
    void enVacanteDeVozElEscritoNoSustituyeAlOral() {
        var candidato = estudiante("A2", "B1", null);
        var vacanteDeVoz = vacante("Teleoperador bilingue", "B1");

        assertEquals(2.0 / 3.0, puntuar(candidato, vacanteDeVoz), 0.001,
                "debe caer al declarado A2, no aprovechar el B1 escrito");
    }
}
