package com.novacrm.matching;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Vocabulario con el que el motor compara perfiles y anuncios.
 *
 * <p>Se prueba con textos reales del programa: el {@code cargoObjetivo} y el
 * {@code sectorObjetivo} que escriben los participantes, y titulos tal como
 * llegan de los portales.
 */
class SkillSynonymsTest {

    private SkillSynonyms sinonimos;

    @BeforeEach
    void configurar() {
        sinonimos = new SkillSynonyms();
        // Que init() no reviente ya es una prueba: valida que ningun sinonimo
        // este declarado bajo dos canonicos en matching-synonyms.yml.
        sinonimos.init();
    }

    /**
     * El cargo que mas se repite en el programa. Antes tokenizaba a un unico
     * token —{@code ingles_nivel}, por "Bilingual"— porque el yml no tenia una
     * sola entrada de BPO ni de servicio al cliente.
     */
    @Test
    void elCargoMasComunDelProgramaTokenizaAAlgoUtil() {
        var tokens = sinonimos.tokenize("Bilingual Customer Service Representative");

        assertTrue(tokens.contains("servicio_cliente"), tokens.toString());
        assertTrue(tokens.contains("ingles_nivel"), tokens.toString());
        assertTrue(tokens.size() >= 2, "deberia reconocer mas de un concepto: " + tokens);
    }

    /** Antes quedaba vacio: ni "BPO" ni "tercerizados" existian en el yml. */
    @Test
    void elSectorObjetivoDeBpoNoQuedaVacio() {
        var tokens = sinonimos.tokenize("BPO / Servicios tercerizados");

        assertFalse(tokens.isEmpty());
        assertTrue(tokens.contains("bpo"), tokens.toString());
    }

    /**
     * La cola larga es el motivo del cambio: lo que no esta declarado se
     * conserva en vez de descartarse, porque el yml no puede enumerar todas las
     * herramientas que aparecen en una hoja de vida.
     */
    @Test
    void lasPalabrasNoDeclaradasSobreviven() {
        var tokens = sinonimos.tokenize("Manejo de Zendesk, SIIGO y Salesforce");

        assertTrue(tokens.contains("zendesk"), tokens.toString());
        assertTrue(tokens.contains("siigo"), tokens.toString());
        assertTrue(tokens.contains("salesforce"), tokens.toString());
    }

    @Test
    void lasPalabrasVaciasNoEntran() {
        var tokens = sinonimos.tokenize(
                "We are looking for a candidate with experience in the role");

        assertFalse(tokens.contains("the"), tokens.toString());
        assertFalse(tokens.contains("with"), tokens.toString());
        assertFalse(tokens.contains("experience"), tokens.toString());
        assertFalse(tokens.contains("role"), tokens.toString());
    }

    /** Coincidir en "2024" o en "500" entre dos anuncios no significa nada. */
    @Test
    void losNumerosSueltosNoEntran() {
        var tokens = sinonimos.tokenize("Salario 2500000 para el ano 2026");

        assertFalse(tokens.contains("2500000"), tokens.toString());
        assertFalse(tokens.contains("2026"), tokens.toString());
    }

    /** Frase larga antes que palabra suelta: si no, "auxiliar" se lo comeria. */
    @Test
    void laFraseMasLargaGanaSobreLaPalabraSuelta() {
        assertTrue(sinonimos.tokenize("Auxiliar de enfermeria").contains("salud_asistencial"));
        assertTrue(sinonimos.tokenize("Auxiliar administrativo").contains("administrativo"));
    }

    @Test
    void losSinonimosDeUnMismoOficioColapsanAlMismoToken() {
        var enEspanol = sinonimos.tokenize("Asesor de atencion al cliente");
        var enIngles = sinonimos.tokenize("Customer support agent");

        assertTrue(enEspanol.contains("servicio_cliente"), enEspanol.toString());
        assertTrue(enIngles.contains("servicio_cliente"), enIngles.toString());
    }

    /** Las tildes y la puntuacion no deben separar dos escrituras del mismo termino. */
    @Test
    void ignoraTildesYPuntuacion() {
        assertEquals(sinonimos.tokenize("Logistica"), sinonimos.tokenize("Logística,"));
    }

    @Test
    void esCanonicoDistingueLoDeclaradoDeLaColaLarga() {
        assertTrue(sinonimos.esCanonico("servicio_cliente"));
        assertFalse(sinonimos.esCanonico("zendesk"));
    }

    /**
     * Deteccion de vacantes de voz sobre el mismo vocabulario. El caso de
     * "invoice" es el que motivo el cambio: el {@code contains} sobre texto
     * crudo encontraba "voice" dentro de esa palabra.
     */
    @Test
    void reconoceLasVacantesDeVozSinFalsosPositivos() {
        assertTrue(VacanteDeVoz.esDeVoz(sinonimos.tokenize("Bilingual Call Center Agent")));
        assertTrue(VacanteDeVoz.esDeVoz(sinonimos.tokenize("Teleoperador inbound")));
        assertTrue(VacanteDeVoz.esDeVoz(sinonimos.tokenize("Asesor de servicio al cliente")));

        assertFalse(VacanteDeVoz.esDeVoz(sinonimos.tokenize("Accounts payable invoice processing")),
                "'voice' dentro de 'invoice' no es una vacante de voz");
        assertFalse(VacanteDeVoz.esDeVoz(sinonimos.tokenize("Auxiliar de bodega")));
        assertFalse(VacanteDeVoz.esDeVoz(sinonimos.tokenize("Data entry back office")),
                "el back office de un BPO no es trabajo de voz");
    }
}
