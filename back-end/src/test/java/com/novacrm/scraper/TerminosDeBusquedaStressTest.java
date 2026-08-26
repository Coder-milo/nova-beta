package com.novacrm.scraper;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Empirical Stress Test Suite & Property Harness for TerminosDeBusqueda.
 *
 * Covers:
 * 1. Diverse multidisciplinary career inputs across 9+ distinct fields:
 *    (Civil Engineering, Law, Accounting, Graphic Design, Data Science, Full Stack, Nurse, Sales, Logistics)
 * 2. Strict non-dropping of non-BPO disciplines
 * 3. Bilingual affix preservation and dynamic enrichment (Spanish vs English roles)
 * 4. Stress testing: nulls, nested nulls, empty collections, emojis, extreme delimiters, diacritics, massive fuzzing
 * 5. Determinism, bounds (<= MAX_TERMINOS), uniqueness (no duplicates)
 */
public class TerminosDeBusquedaStressTest {

    @Test
    @DisplayName("STRESS-1: Multi-discipline coverage across 9+ distinct professional sectors")
    public void testDiverseMultiDisciplinaryCareers() {
        // 9 explicit disciplines requested in Challenger mission
        List<String> civilEng = List.of("Ingeniero Civil", "Ingeniería Civil y Construcción", "Civil Engineer");
        List<String> law = List.of("Abogado Corporativo", "Derecho Internacional", "Legal Counsel");
        List<String> accounting = List.of("Contador Público", "Auditor Financiero", "Financial Analyst");
        List<String> design = List.of("Diseñador Gráfico", "Diseño UX UI", "Graphic Designer");
        List<String> dataScience = List.of("Científico de Datos", "Data Scientist", "Machine Learning Specialist");
        List<String> fullStack = List.of("Desarrollador Full Stack", "Full Stack Developer", "Software Engineer");
        List<String> nurse = List.of("Enfermero Profesional", "Jefe de Enfermería", "Registered Nurse");
        List<String> sales = List.of("Ejecutivo de Ventas", "Account Executive", "Gerente Comercial");
        List<String> logistics = List.of("Coordinador de Logística", "Supply Chain Analyst", "Ingeniero Logístico");

        List<String> todosLosCargos = new ArrayList<>();
        todosLosCargos.addAll(civilEng);
        todosLosCargos.addAll(law);
        todosLosCargos.addAll(accounting);
        todosLosCargos.addAll(design);
        todosLosCargos.addAll(dataScience);
        todosLosCargos.addAll(fullStack);
        todosLosCargos.addAll(nurse);
        todosLosCargos.addAll(sales);
        todosLosCargos.addAll(logistics);

        var resultado = TerminosDeBusqueda.desdeEstudiantes(todosLosCargos, List.of());

        assertNotNull(resultado, "Resultado no debe ser nulo");
        assertEquals(TerminosDeBusqueda.MAX_TERMINOS, resultado.size(), "Debe respetar el tope MAX_TERMINOS (10)");
        assertEquals(Set.copyOf(resultado).size(), resultado.size(), "No debe tener términos duplicados");

        // Test each discipline individually to ensure none are dropped or rejected
        verificarDisciplinaPresente(List.of("Ingeniero Civil"), "civil");
        verificarDisciplinaPresente(List.of("Abogado Corporativo"), "abogado");
        verificarDisciplinaPresente(List.of("Contador Público"), "contador");
        verificarDisciplinaPresente(List.of("Diseñador Gráfico"), "disenador");
        verificarDisciplinaPresente(List.of("Científico de Datos"), "datos");
        verificarDisciplinaPresente(List.of("Full Stack Developer"), "full stack");
        verificarDisciplinaPresente(List.of("Enfermero Profesional"), "enfermero");
        verificarDisciplinaPresente(List.of("Ejecutivo de Ventas"), "ventas");
        verificarDisciplinaPresente(List.of("Coordinador de Logística"), "logistica");
    }

    private void verificarDisciplinaPresente(List<String> cargos, String expectedToken) {
        var terminos = TerminosDeBusqueda.desdeEstudiantes(cargos, List.of());
        boolean presente = terminos.stream().anyMatch(t -> t.contains(expectedToken));
        assertTrue(presente, "La disciplina con token '" + expectedToken + "' debe estar presente en el resultado: " + terminos);
    }

    @Test
    @DisplayName("STRESS-2: Non-BPO discipline priority - Pure non-BPO input preserves all non-BPO tokens")
    public void testNonBpoDisciplineNotDropped() {
        // Pure non-BPO input across traditional disciplines
        List<String> nonBpoCargos = List.of(
                "Ingeniero Civil Estructural",
                "Abogado Laboral",
                "Contador Tributario",
                "Arquitecto de Obras",
                "Médico General",
                "Psicólogo Organizacional",
                "Trabajador Social",
                "Biólogo Marino",
                "Químico Farmacéutico",
                "Economista Financiero"
        );

        var resultado = TerminosDeBusqueda.desdeEstudiantes(nonBpoCargos, List.of());

        assertEquals(10, resultado.size());
        assertTrue(resultado.stream().anyMatch(t -> t.contains("ingeniero civil")), "Debe incluir Ingeniero Civil");
        assertTrue(resultado.stream().anyMatch(t -> t.contains("abogado laboral")), "Debe incluir Abogado");
        assertTrue(resultado.stream().anyMatch(t -> t.contains("contador tributario")), "Debe incluir Contador");
        assertTrue(resultado.stream().anyMatch(t -> t.contains("arquitecto")), "Debe incluir Arquitecto");
        assertTrue(resultado.stream().anyMatch(t -> t.contains("medico general")), "Debe incluir Médico");
        assertTrue(resultado.stream().anyMatch(t -> t.contains("psicologo")), "Debe incluir Psicólogo");
        assertTrue(resultado.stream().anyMatch(t -> t.contains("trabajador social")), "Debe incluir Trabajador Social");
        assertTrue(resultado.stream().anyMatch(t -> t.contains("biologo marino")), "Debe incluir Biólogo");
        assertTrue(resultado.stream().anyMatch(t -> t.contains("quimico farmaceutico")), "Debe incluir Químico");
        assertTrue(resultado.stream().anyMatch(t -> t.contains("economista financiero")), "Debe incluir Economista");
    }

    @Test
    @DisplayName("STRESS-3: Bilingual affix rules - Missing affixes enriched, existing affixes preserved")
    public void testBilingualAffixEnrichmentAndPreservation() {
        // 1. Spanish roles without language affix -> append " bilingue"
        assertEquals("ingeniero civil bilingue", TerminosDeBusqueda.enriquecerTermino("ingeniero civil"));
        assertEquals("abogado corporativo bilingue", TerminosDeBusqueda.enriquecerTermino("abogado corporativo"));
        assertEquals("contador tributario bilingue", TerminosDeBusqueda.enriquecerTermino("contador tributario"));
        assertEquals("enfermero jefe bilingue", TerminosDeBusqueda.enriquecerTermino("enfermero jefe"));
        assertEquals("docente universitario bilingue", TerminosDeBusqueda.enriquecerTermino("docente universitario"));

        // 2. English roles without language affix -> prepend "bilingual "
        assertEquals("bilingual software engineer", TerminosDeBusqueda.enriquecerTermino("software engineer"));
        assertEquals("bilingual data scientist", TerminosDeBusqueda.enriquecerTermino("data scientist"));
        assertEquals("bilingual full stack developer", TerminosDeBusqueda.enriquecerTermino("full stack developer"));
        assertEquals("bilingual product manager", TerminosDeBusqueda.enriquecerTermino("product manager"));
        assertEquals("bilingual ui designer", TerminosDeBusqueda.enriquecerTermino("ui designer"));
        assertEquals("bilingual qa automation", TerminosDeBusqueda.enriquecerTermino("qa automation"));
        assertEquals("bilingual devops specialist", TerminosDeBusqueda.enriquecerTermino("devops specialist"));
        assertEquals("bilingual solutions architect", TerminosDeBusqueda.enriquecerTermino("solutions architect"));
        assertEquals("bilingual frontend engineer", TerminosDeBusqueda.enriquecerTermino("frontend engineer"));
        assertEquals("bilingual backend lead", TerminosDeBusqueda.enriquecerTermino("backend lead"));

        // 3. Spanish roles already containing bilingual affixes (normalized) -> preserved without double affixing
        assertEquals("ingeniero bilingue", TerminosDeBusqueda.enriquecerTermino("ingeniero bilingue"));
        assertEquals("abogado bilingue", TerminosDeBusqueda.enriquecerTermino("abogado bilingue"));
        assertEquals("profesor de ingles", TerminosDeBusqueda.enriquecerTermino("profesor de ingles"));
        assertEquals("secretaria bilingue ejecutiva", TerminosDeBusqueda.enriquecerTermino("secretaria bilingue ejecutiva"));
        assertEquals("asesor ingles c1", TerminosDeBusqueda.enriquecerTermino("asesor ingles c1"));
        assertEquals("agente b2 bpo", TerminosDeBusqueda.enriquecerTermino("agente b2 bpo"));

        // 4. English roles already containing bilingual affixes -> preserved without double affixing
        assertEquals("bilingual registered nurse", TerminosDeBusqueda.enriquecerTermino("bilingual registered nurse"));
        assertEquals("bilingual customer support", TerminosDeBusqueda.enriquecerTermino("bilingual customer support"));
        assertEquals("english literature teacher", TerminosDeBusqueda.enriquecerTermino("english literature teacher"));
        assertEquals("bilingual data analyst", TerminosDeBusqueda.enriquecerTermino("bilingual data analyst"));

        // 5. Detection of bilingual tokens in normalized text
        assertTrue(TerminosDeBusqueda.tieneMarcaBilingue("abogado bilingue"));
        assertTrue(TerminosDeBusqueda.tieneMarcaBilingue("traductor de ingles"));
        assertTrue(TerminosDeBusqueda.tieneMarcaBilingue("bilingual agent"));
        assertTrue(TerminosDeBusqueda.tieneMarcaBilingue("customer service bpo"));
        assertTrue(TerminosDeBusqueda.tieneMarcaBilingue("perfil c1 ingles"));
        assertTrue(TerminosDeBusqueda.tieneMarcaBilingue("nivel b2 conversacional"));
    }

    @Test
    @DisplayName("STRESS-4: Adversarial strings, emojis, extreme delimiters, unicode diacritics")
    public void testAdversarialStringsAndEmojis() {
        // Emojis, punctuation, extreme delimiters
        String weirdInput = "🚀 Full Stack Developer 🔥 / 📊 Data Analyst 🤖 ;;; ⚖️ Abogado Penalista 🏛️ & 🏥 Enfermero Jefe 💉 y 🎨 Diseñador UX 🖌️ and 🏗️ Ingeniero Civil 🏢";
        var troceados = TerminosDeBusqueda.trocear(weirdInput);

        assertFalse(troceados.isEmpty());
        assertTrue(troceados.contains("full stack developer"), "Emoji strip should preserve full stack developer");
        assertTrue(troceados.contains("data analyst"), "Emoji strip should preserve data analyst");
        assertTrue(troceados.contains("abogado penalista"), "Emoji strip should preserve abogado penalista");
        assertTrue(troceados.contains("enfermero jefe"), "Emoji strip should preserve enfermero jefe");
        assertTrue(troceados.contains("disenador ux"), "Emoji strip should preserve disenador ux");
        assertTrue(troceados.contains("ingeniero civil"), "Emoji strip should preserve ingeniero civil");

        // Extreme delimiters and connector words (y, e, and, /, |, ,, ;, &)
        String delimiterHell = "Civil///Industrial;;;Mecatrónico,,,Electrónico&&&Ambiental y Forestal e Hidráulico and Sanitario";
        var partes = TerminosDeBusqueda.trocear(delimiterHell);
        assertTrue(partes.contains("civil"));
        assertTrue(partes.contains("industrial"));
        assertTrue(partes.contains("mecatronico"));
        assertTrue(partes.contains("electronico"));
        assertTrue(partes.contains("ambiental"));
        assertTrue(partes.contains("forestal"));
        assertTrue(partes.contains("hidraulico"));
        assertTrue(partes.contains("sanitario"));

        // Diacritics stripping
        assertEquals("ingenieria electronica y telecomunicaciones",
                TerminosDeBusqueda.limpiar("  ¡¡Ingeniería Electrónica y Telecomunicaciones!!  "));
        // Trimming to max 4 words in limpiar()
        assertEquals("diseno visual y animacion",
                TerminosDeBusqueda.limpiar("Diseño Visual y Animación Digital 3D???"));

        // Overly long text clipping (>= 50 words)
        StringBuilder longText = new StringBuilder();
        for (int i = 0; i < 60; i++) {
            longText.append("palabra").append(i).append(" ");
        }
        String cleaned = TerminosDeBusqueda.limpiar(longText.toString());
        assertEquals(4, cleaned.split("\\s+").length, "Limpiar debe limitar a max 4 palabras");
    }

    @Test
    @DisplayName("STRESS-5: Null-safety and edge cases in all public methods")
    public void testNullSafetyAndEdgeCases() {
        // Null and empty inputs to desdeEstudiantes
        assertDoesNotThrow(() -> TerminosDeBusqueda.desdeEstudiantes((List<String>[]) null));
        assertDoesNotThrow(() -> TerminosDeBusqueda.desdeEstudiantes(null, null));
        assertDoesNotThrow(() -> TerminosDeBusqueda.desdeEstudiantes(null, null, null, null, null));
        assertDoesNotThrow(() -> TerminosDeBusqueda.desdeEstudiantes(Collections.emptyList(), Collections.emptyList()));

        assertEquals(TerminosDeBusqueda.RESPALDO, TerminosDeBusqueda.desdeEstudiantes((List<String>[]) null));
        assertEquals(TerminosDeBusqueda.RESPALDO, TerminosDeBusqueda.desdeEstudiantes(null, null));
        assertEquals(TerminosDeBusqueda.RESPALDO, TerminosDeBusqueda.desdeEstudiantes(null, null, null, null, null));
        assertEquals(TerminosDeBusqueda.RESPALDO, TerminosDeBusqueda.desdeEstudiantes(List.of(""), List.of("   ")));

        // Lists with embedded nulls and blank items
        List<String> listWithNulls = Arrays.asList(null, "", "   ", "Ingeniero Civil", null, "Abogado");
        var resultWithNulls = TerminosDeBusqueda.desdeEstudiantes(listWithNulls, null);
        assertNotNull(resultWithNulls);
        assertEquals(10, resultWithNulls.size());
        assertTrue(resultWithNulls.contains("ingeniero civil bilingue"));
        assertTrue(resultWithNulls.contains("abogado bilingue"));

        // Null safety on helper methods
        assertNull(TerminosDeBusqueda.enriquecerTermino(null));
        assertNull(TerminosDeBusqueda.enriquecerTermino(""));
        assertNull(TerminosDeBusqueda.enriquecerTermino("   "));

        assertFalse(TerminosDeBusqueda.tieneMarcaBilingue(null));
        assertFalse(TerminosDeBusqueda.tieneMarcaBilingue(""));
        assertFalse(TerminosDeBusqueda.tieneMarcaBilingue("   "));

        assertEquals(List.of(), TerminosDeBusqueda.trocear(null));
        assertEquals(List.of(), TerminosDeBusqueda.trocear(""));
        assertEquals(List.of(), TerminosDeBusqueda.trocear("   "));

        assertEquals("", TerminosDeBusqueda.limpiar(null));
        assertEquals("", TerminosDeBusqueda.limpiar(""));
        assertEquals("", TerminosDeBusqueda.limpiar("   "));

        assertEquals("", TerminosDeBusqueda.recortarPalabras(null, 3));
        assertEquals("", TerminosDeBusqueda.recortarPalabras("", 3));
        assertEquals("uno dos", TerminosDeBusqueda.recortarPalabras("uno dos tres cuatro", 2));

        assertEquals(List.of("Colombia"), TerminosDeBusqueda.ciudades(null));
        assertEquals(List.of("Colombia"), TerminosDeBusqueda.ciudades(List.of()));
    }

    @Test
    @DisplayName("STRESS-6: Fuzzing with 1,000 random permutations")
    public void testRandomFuzzing() {
        String[] pool = {
                "Civil Engineering", "Derecho Penal", "Contaduría y Finanzas", "Graphic Designer",
                "Data Science / AI", "Full Stack Developer", "Enfermería Clínica", "Sales Executive",
                "Supply Chain / Logistics", "Architect", "Bilingual Support", "Docente de Inglés",
                "asesor b2", "QA Specialist", "Marketing Digital", "null", "", " ", "🔥🔥🔥",
                "y", "e", "and", "/", ";", ",", "Super Long Career Title With Many Extraneous Descriptive Words That Exceeds Normal Search Length"
        };

        Random rng = new Random(42); // Deterministic seed
        for (int iter = 0; iter < 1000; iter++) {
            int size1 = rng.nextInt(6);
            int size2 = rng.nextInt(6);
            List<String> list1 = new ArrayList<>();
            List<String> list2 = new ArrayList<>();

            for (int i = 0; i < size1; i++) {
                String token = pool[rng.nextInt(pool.length)];
                list1.add(token.equals("null") ? null : token);
            }
            for (int i = 0; i < size2; i++) {
                String token = pool[rng.nextInt(pool.length)];
                list2.add(token.equals("null") ? null : token);
            }

            var terms = TerminosDeBusqueda.desdeEstudiantes(list1, list2);
            assertNotNull(terms, "Fuzzing returned null at iter " + iter);
            assertTrue(terms.size() <= TerminosDeBusqueda.MAX_TERMINOS, "Exceeded MAX_TERMINOS at iter " + iter + ": " + terms.size());
            assertFalse(terms.isEmpty(), "Returned empty terms at iter " + iter);
            assertEquals(Set.copyOf(terms).size(), terms.size(), "Duplicates found at iter " + iter + ": " + terms);
        }
    }

    /**
     * Standalone CLI runner for direct execution without depending on external test runners.
     */
    public static void main(String[] args) {
        System.out.println("=== Starting Empirical Stress Tests for TerminosDeBusqueda ===");
        TerminosDeBusquedaStressTest harness = new TerminosDeBusquedaStressTest();
        int passed = 0;
        int failed = 0;

        try {
            System.out.print("[TEST 1/6] Running testDiverseMultiDisciplinaryCareers... ");
            harness.testDiverseMultiDisciplinaryCareers();
            System.out.println("PASSED");
            passed++;
        } catch (Throwable t) {
            System.out.println("FAILED: " + t.getMessage());
            t.printStackTrace();
            failed++;
        }

        try {
            System.out.print("[TEST 2/6] Running testNonBpoDisciplineNotDropped... ");
            harness.testNonBpoDisciplineNotDropped();
            System.out.println("PASSED");
            passed++;
        } catch (Throwable t) {
            System.out.println("FAILED: " + t.getMessage());
            t.printStackTrace();
            failed++;
        }

        try {
            System.out.print("[TEST 3/6] Running testBilingualAffixEnrichmentAndPreservation... ");
            harness.testBilingualAffixEnrichmentAndPreservation();
            System.out.println("PASSED");
            passed++;
        } catch (Throwable t) {
            System.out.println("FAILED: " + t.getMessage());
            t.printStackTrace();
            failed++;
        }

        try {
            System.out.print("[TEST 4/6] Running testAdversarialStringsAndEmojis... ");
            harness.testAdversarialStringsAndEmojis();
            System.out.println("PASSED");
            passed++;
        } catch (Throwable t) {
            System.out.println("FAILED: " + t.getMessage());
            t.printStackTrace();
            failed++;
        }

        try {
            System.out.print("[TEST 5/6] Running testNullSafetyAndEdgeCases... ");
            harness.testNullSafetyAndEdgeCases();
            System.out.println("PASSED");
            passed++;
        } catch (Throwable t) {
            System.out.println("FAILED: " + t.getMessage());
            t.printStackTrace();
            failed++;
        }

        try {
            System.out.print("[TEST 6/6] Running testRandomFuzzing (1,000 permutations)... ");
            harness.testRandomFuzzing();
            System.out.println("PASSED");
            passed++;
        } catch (Throwable t) {
            System.out.println("FAILED: " + t.getMessage());
            t.printStackTrace();
            failed++;
        }

        System.out.println("\n=== SUMMARY ===");
        System.out.println("Total tests: " + (passed + failed) + " | Passed: " + passed + " | Failed: " + failed);
        if (failed > 0) {
            System.exit(1);
        } else {
            System.out.println("ALL EMPIRICAL STRESS TESTS PASSED SUCCESSFULLY!");
            System.exit(0);
        }
    }
}
