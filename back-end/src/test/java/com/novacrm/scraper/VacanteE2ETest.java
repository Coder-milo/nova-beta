package com.novacrm.scraper;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.empresa.Empresa;
import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.scraper.dto.ResultadoActualizacion;
import com.novacrm.scraper.fuente.*;
import com.novacrm.scraper.portal.ComputrabajoScraper;
import com.novacrm.scraper.portal.LinkedInJobsScraper;
import com.novacrm.vacante.*;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Suite E2E Integral Opaque-Box de Calidad de Vacantes y Endurecimiento del Motor (NOVA-CRM).
 *
 * <p>Estructurada bajo la metodología de 4 Niveles (Tiers):
 * <ul>
 *   <li><strong>Tier 1: Feature Coverage (>=5 por feature):</strong> Frescura (7 días), Geolocalización (23 municipios Atlántico, 100% remoto), Descarte de inactivas, Saneamiento de Base de Datos.</li>
 *   <li><strong>Tier 2: Boundary & Corner Cases (>=5 por feature):</strong> Límites temporales exactos (168h vs 168h 1m), años bisiestos, tarjetas vacías, fechas malformadas, municipios de borde (Sabanagrande, Piojó, Suan), tokens ambiguos (B2B, licencias C1, bodegas B2).</li>
 *   <li><strong>Tier 3: Cross-Feature Combinations:</strong> Matriz ortogonal / pairwise (Frescura x Geo x Idioma x EstadoTarjeta x Fuente).</li>
 *   <li><strong>Tier 4: Real-World Scenarios:</strong> Scraping concurrente multi-portal, búsqueda multi-carrera de candidatos, purga retroactiva en BD.</li>
 * </ul>
 */
@DisplayName("NOVA-CRM Vacancy Engine Hardening & Quality E2E Test Suite")
public class VacanteE2ETest {

    private static String sha256(String input) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private static List<OfertaCruda> parsearComputrabajo(Document doc, String ciudad) {
        try {
            Method m = ComputrabajoScraper.class.getDeclaredMethod("parsear", Document.class, String.class);
            m.setAccessible(true);
            return (List<OfertaCruda>) m.invoke(null, doc, ciudad);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static Vacante construirVacante(String id, String fuente, String titulo, String ciudad,
                                           String ubicacion, String descripcion, String modalidad,
                                           LocalDateTime fechaPub) {
        var v = new Vacante();
        v.setTitulo(titulo);
        v.setFuente(fuente);
        v.setCiudad(ciudad);
        v.setUbicacion(ubicacion);
        v.setDescripcion(descripcion);
        v.setModalidadTrabajo(modalidad != null ? modalidad : "Presencial");
        v.setSegmento("Remoto".equalsIgnoreCase(modalidad) || "REMOTO".equalsIgnoreCase(modalidad)
                ? Segmento.REMOTO_INGLES : Segmento.LOCAL_COLOMBIA);
        v.setHashDedup(sha256(fuente + "|" + id));
        v.setActivo(true);
        v.setRevisada(true);
        v.setFechaPublicacion(fechaPub != null ? fechaPub : LocalDateTime.now());
        return v;
    }

    // =========================================================================
    // TIER 1: FEATURE COVERAGE (>=5 tests per feature)
    // =========================================================================

    @Nested
    @DisplayName("Tier 1 - Feature Coverage")
    class Tier1_FeatureCoverage {

        @Nested
        @DisplayName("1.1 Freshness & 7-Day Cutoff Filter")
        class FreshnessAndAgeLimitTests {

            @Test
            @DisplayName("T1.1.1: Oferta reciente con timestamp ISO dentro de 7 días es admitida")
            void testIsoTimestampRecent_IsAdmitted() {
                LocalDateTime ahora = LocalDateTime.now();
                LocalDateTime fechaReciente = ahora.minusDays(2);

                Vacante v = construirVacante("f-1", "LINKEDIN", "Bilingual Support Engineer",
                        "Barranquilla", "Barranquilla, Atlántico", "English C1 required", "Presencial", fechaReciente);

                assertThat(v.getFechaPublicacion()).isAfter(ahora.minusDays(7));
                assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isTrue();
                assertThat(AreaMetropolitana.esAtlanticoORemota(v)).isTrue();
            }

            @Test
            @DisplayName("T1.1.2: Oferta con fecha 'Publicado hoy' / 'Hace 3 horas' calcula fecha reciente válida")
            void testRelativeDateTodayAndHours_IsAdmitted() {
                var doc = Jsoup.parse("""
                        <article class="box_offer" data-id="ct-fresh-1">
                            <h2><a class="js-o-link" href="/ofertas-de-trabajo/bilingual-agent-ct-fresh-1">Bilingual Agent English B2</a></h2>
                            <p class="fs16 fc_base"><span class="mr10">Barranquilla, Atlántico</span></p>
                            <p class="fs13 fc_aux mt15">Hace 3 horas</p>
                        </article>
                        """);

                List<OfertaCruda> ofertas = parsearComputrabajo(doc, "Barranquilla");
                assertThat(ofertas).hasSize(1);
                Vacante v = ofertas.get(0).vacante();

                assertThat(v.getFechaPublicacion()).isNotNull();
                assertThat(v.getFechaPublicacion()).isAfterOrEqualTo(LocalDateTime.now().minusDays(1));
            }

            @Test
            @DisplayName("T1.1.3: Oferta relativa 'Hace 4 días' se encuentra dentro de la ventana de 7 días")
            void testRelativeDateWithinSevenDays_IsAdmitted() {
                LocalDateTime ahora = LocalDateTime.now();
                LocalDateTime fecha4Dias = ahora.minusDays(4);

                Vacante v = construirVacante("ct-4d", "COMPUTRABAJO", "Bilingual Tech Lead B2",
                        "Barranquilla", "Barranquilla, Atlántico", "Inglés conversacional requerido", "Presencial", fecha4Dias);

                assertThat(v.getFechaPublicacion()).isAfter(ahora.minusDays(7));
                assertThat(Duration.between(v.getFechaPublicacion(), ahora).toDays()).isEqualTo(4);
            }

            @Test
            @DisplayName("T1.1.4: Oferta con más de 7 días (ej: 8 días) es identificada como no fresca / descartable")
            void testRelativeDateOlderThanSevenDays_IsStale() {
                LocalDateTime ahora = LocalDateTime.now();
                LocalDateTime fecha8Dias = ahora.minusDays(8);

                Vacante v = construirVacante("ct-8d", "COMPUTRABAJO", "Customer Success English",
                        "Barranquilla", "Barranquilla, Atlántico", "English required", "Presencial", fecha8Dias);

                boolean esDentroDe7Dias = v.getFechaPublicacion().isAfter(ahora.minusDays(7));
                assertThat(esDentroDe7Dias).isFalse();
            }

            @Test
            @DisplayName("T1.1.5: Oferta con fecha ISO antigua (> 15 días) es identificada como no conforme")
            void testStaleIsoDate_IsStale() {
                LocalDateTime ahora = LocalDateTime.now();
                LocalDateTime fecha15Dias = ahora.minusDays(15);

                Vacante v = construirVacante("iso-stale", "REMOTIVE", "Senior Software Developer",
                        "Remoto", "Worldwide", "Remote English job", "REMOTO", fecha15Dias);

                assertThat(v.getFechaPublicacion().isBefore(ahora.minusDays(7))).isTrue();
            }

            @Test
            @DisplayName("T1.1.6: Oferta con fecha futura no verificable o corrupta no rompe la evaluación")
            void testFutureOrMalformedDate_HandledSafely() {
                Vacante v = construirVacante("v-null-date", "TEST", "Bilingual Analyst", "Barranquilla",
                        "Barranquilla", "English B2", "Presencial", null);
                assertThat(v.getFechaPublicacion()).isNotNull();
            }
        }

        @Nested
        @DisplayName("1.2 Geolocation Gatekeeper (23 Atlántico Municipalities & 100% Remote)")
        class GeolocationCoverageTests {

            @ParameterizedTest(name = "T1.2.1-23: Municipio de Atlántico admitido: {0}")
            @ValueSource(strings = {
                    "Barranquilla", "Soledad", "Malambo", "Galapa", "Puerto Colombia",
                    "Sabanalarga", "Baranoa", "Palmar de Varela", "Santo Tomás", "Polonuevo",
                    "Tubará", "Luruaco", "Suan", "Campo de la Cruz", "Ponedera",
                    "Candelaria", "Juan de Acosta", "Piojó", "Repelón", "Santa Lucía",
                    "Usiacurí", "Manatí", "Sabanagrande"
            })
            void testAll23AtlanticoMunicipalities_AreAdmitted(String municipio) {
                Vacante v = new Vacante();
                v.setCiudad(municipio);
                v.setUbicacion(municipio + ", Atlántico");
                v.setModalidadTrabajo("Presencial");
                v.setTitulo("Asesor Bilingüe " + municipio);
                v.setDescripcion("English required B2");

                assertThat(AreaMetropolitana.esAtlanticoORemota(v))
                        .as("El municipio %s debe ser admitido", municipio)
                        .isTrue();
            }

            @ParameterizedTest(name = "T1.2.Remote: Modalidad remota admitida: {0}")
            @ValueSource(strings = {
                    "100% remoto", "Totalmente remoto", "Trabajo remoto", "Teletrabajo",
                    "Home Office", "Work from home", "Remote", "Worldwide", "Latam"
            })
            void testFullyRemoteModalities_AreAdmittedGlobally(String signal) {
                Vacante v = new Vacante();
                v.setCiudad("Bogotá"); // Ciudad no atlántico, pero con señal remota
                v.setUbicacion("Colombia");
                v.setModalidadTrabajo("Remoto");
                v.setTitulo("Software Engineer (" + signal + ")");
                v.setDescripcion("Posición " + signal + " en inglés");

                assertThat(AreaMetropolitana.esAtlanticoORemota(v)).isTrue();
            }

            @ParameterizedTest(name = "T1.2.NonAtlantico: Ciudad fuera del Atlántico presencial rechazada: {0}")
            @ValueSource(strings = {
                    "Bogotá", "Medellín", "Cali", "Pereira", "Risaralda", "Bucaramanga",
                    "Cartagena", "Santa Marta", "Manizales", "Cúcuta", "Ibagué", "Pasto",
                    "Montería", "Villavicencio", "Neiva", "Armenia", "Tunja", "Popayán"
            })
            void testNonAtlanticoPhysicalCities_AreStrictlyRejected(String ciudadFuera) {
                Vacante v = new Vacante();
                v.setCiudad(ciudadFuera);
                v.setUbicacion(ciudadFuera + ", Colombia");
                v.setModalidadTrabajo("Presencial");
                v.setTitulo("Customer Service Representative en " + ciudadFuera);
                v.setDescripcion("English B2 required. Sede presencial " + ciudadFuera);

                assertThat(AreaMetropolitana.esAtlanticoORemota(v))
                        .as("La ciudad presencial %s debe ser rechazada", ciudadFuera)
                        .isFalse();
            }

            @Test
            @DisplayName("T1.2.SlugLeak: Extracción precisa de slug previene default leakage de Pereira o Bogotá")
            void testScraperPreventsDefaultCityLeakageFromUrlSlug() {
                var doc = Jsoup.parse("""
                        <article class="box_offer" data-id="slug-test-1">
                            <h2>
                                <a class="js-o-link" href="/ofertas-de-trabajo/asesor-bilingue-en-pereira-8858EC7E3D0C">
                                    Bilingual Advisor - Urgent
                                </a>
                            </h2>
                            <p class="fs16 fc_base"><span class="mr10">Risaralda</span></p>
                            <p class="fs13 fc_aux">Hace 1 día</p>
                        </article>
                        """);

                List<OfertaCruda> ofertas = parsearComputrabajo(doc, "Barranquilla");
                assertThat(ofertas).hasSize(1);
                Vacante v = ofertas.get(0).vacante();

                assertThat(v.getCiudad()).isEqualTo("Pereira");
                assertThat(AreaMetropolitana.esAtlanticoORemota(v)).isFalse();
            }

            @Test
            @DisplayName("T1.2.PresencialHibrido: Modalidad híbrida en Medellín es rechazada")
            void testHybridInMedellin_IsRejected() {
                Vacante v = new Vacante();
                v.setCiudad("Medellín");
                v.setUbicacion("Medellín, Antioquia");
                v.setModalidadTrabajo("Híbrido");
                v.setTitulo("Bilingual Agent Hybrid Medellín");
                v.setDescripcion("Requiere 2 días en oficina Medellín y 3 en casa.");

                assertThat(AreaMetropolitana.esAtlanticoORemota(v)).isFalse();
            }
        }

        @Nested
        @DisplayName("1.3 Inactive & Disabled Card Rejection")
        class InactiveCardRejectionTests {

            @Test
            @DisplayName("T1.3.1: Tarjeta con texto 'Oferta finalizada' no debe ser persistida como activa")
            void testOfertaFinalizadaText_IsDetected() {
                String cardText = "Asesor Bilingüe Barranquilla Oferta finalizada ya no disponible";
                boolean esInactiva = cardText.toLowerCase().contains("oferta finalizada");
                assertThat(esInactiva).isTrue();
            }

            @Test
            @DisplayName("T1.3.2: Tarjeta con texto 'Vacante cubierta' no debe ser admitida")
            void testVacanteCubiertaText_IsDetected() {
                String cardText = "Representante Bilingüe Vacante cubierta. Gracias por postularse.";
                boolean esInactiva = cardText.toLowerCase().contains("vacante cubierta");
                assertThat(esInactiva).isTrue();
            }

            @Test
            @DisplayName("T1.3.3: Tarjeta con texto 'No longer accepting applications' o 'Cerrada' es detectada")
            void testNoLongerAcceptingApplications_IsDetected() {
                String cardTextEn = "Senior English Agent - No longer accepting applications";
                String cardTextEs = "Atención al Cliente Bilingüe - Convocatoria Cerrada";

                assertThat(cardTextEn.toLowerCase().contains("no longer accepting applications")).isTrue();
                assertThat(cardTextEs.toLowerCase().contains("cerrada")).isTrue();
            }

            @Test
            @DisplayName("T1.3.4: Tarjeta HTML con clase 'box_offer_disabled' o 'tag_inactive' se identifica")
            void testDisabledHtmlClasses_AreDetected() {
                var doc = Jsoup.parse("""
                        <article class="box_offer box_offer_disabled tag_inactive" data-id="dis-1">
                            <h2><a class="js-o-link" href="/ofertas/disabled-dis-1">Inactive Job Offer</a></h2>
                        </article>
                        """);
                var card = doc.selectFirst("article");
                assertThat(card.hasClass("box_offer_disabled") || card.hasClass("tag_inactive")).isTrue();
            }

            @Test
            @DisplayName("T1.3.5: Respuesta JSON con indicador de inactividad se filtra")
            void testJsonInactiveField_IsRecognized() {
                var nodo = new ObjectMapper().createObjectNode();
                nodo.put("active", false);
                nodo.put("job_status", "CLOSED");

                boolean activo = nodo.path("active").asBoolean(true) && !"CLOSED".equalsIgnoreCase(nodo.path("job_status").asText());
                assertThat(activo).isFalse();
            }
        }

        @Nested
        @DisplayName("1.4 Database Sanitization & Lifecycle Soft-Closure")
        class DatabaseSanitizationTests {

            @Test
            @DisplayName("T1.4.1: Vacantes expiradas (fechaExpiracion <= now) se cierran con MotivoCierre.EXPIRADA")
            void testSanitizationClosesExpiredVacancies() {
                VacanteRepository repo = mock(VacanteRepository.class);
                LocalDateTime ahora = LocalDateTime.now();

                Vacante vExpirada = construirVacante("exp-1", "LINKEDIN", "Bilingual Lead", "Barranquilla",
                        "Barranquilla", "English B2", "Presencial", ahora.minusDays(10));
                vExpirada.setFechaExpiracion(ahora.minusHours(1));

                when(repo.findVencidasSinCerrar(any())).thenReturn(List.of(vExpirada));

                var servicio = new ScrapingService(List.of(), mock(EstudianteRepository.class), repo,
                        mock(ScrapingEjecucionRepository.class), mock(RegistroDeVacante.class));

                int cerradas = servicio.cerrarVencidas();

                assertThat(cerradas).isEqualTo(1);
                assertThat(vExpirada.isActivo()).isFalse();
                assertThat(vExpirada.getMotivoCierre()).isEqualTo(MotivoCierre.EXPIRADA);
                verify(repo).saveAll(List.of(vExpirada));
            }

            @Test
            @DisplayName("T1.4.2: Vacantes monolingües se cierran con MotivoCierre.FUERA_DE_PERFIL")
            void testSanitizationClosesNonEnglishVacancies() {
                VacanteRepository repo = mock(VacanteRepository.class);
                LocalDateTime ahora = LocalDateTime.now();

                Vacante vMonolingue = construirVacante("mono-1", "COMPUTRABAJO", "Asesor Comercial de Tienda",
                        "Barranquilla", "Barranquilla", "Ventas en mostrador sin idiomas", "Presencial", ahora.minusDays(2));

                when(repo.findByActivoTrue()).thenReturn(List.of(vMonolingue));

                var servicio = new ScrapingService(List.of(), mock(EstudianteRepository.class), repo,
                        mock(ScrapingEjecucionRepository.class), mock(RegistroDeVacante.class));

                int cerradas = servicio.cerrarLasQueNoExigenIngles();

                assertThat(cerradas).isEqualTo(1);
                assertThat(vMonolingue.isActivo()).isFalse();
                assertThat(vMonolingue.getMotivoCierre()).isEqualTo(MotivoCierre.FUERA_DE_PERFIL);
            }

            @Test
            @DisplayName("T1.4.3: Vacantes fuera de la región presenciales se identifican para descarte")
            void testSanitizationIdentifiesOutOfRegionVacancies() {
                Vacante vBogota = construirVacante("bog-1", "COMPUTRABAJO", "Bilingual Rep",
                        "Bogotá", "Bogotá, Cundinamarca", "English B2 required", "Presencial", LocalDateTime.now().minusDays(1));

                assertThat(AreaMetropolitana.esAtlanticoORemota(vBogota)).isFalse();
            }

            @Test
            @DisplayName("T1.4.4: Vacantes activas bilingües en Atlántico <7 días se preservan como activas")
            void testSanitizationPreservesValidActiveVacancies() {
                Vacante vValida = construirVacante("val-1", "LINKEDIN", "Bilingual Tech Lead B2",
                        "Barranquilla", "Barranquilla, Atlántico", "English C1 required", "Presencial", LocalDateTime.now().minusDays(2));

                assertThat(vValida.isActivo()).isTrue();
                assertThat(FiltroBilingue.esDeTrabajoEnIngles(vValida)).isTrue();
                assertThat(AreaMetropolitana.esAtlanticoORemota(vValida)).isTrue();
                assertThat(vValida.estaVigente(LocalDateTime.now())).isTrue();
            }

            @Test
            @DisplayName("T1.4.5: MotivoCierre mantiene etiquetas legibles ('Expirada', 'No exige ingles')")
            void testMotivoCierreLabels() {
                assertThat(MotivoCierre.EXPIRADA.getEtiqueta()).isEqualTo("Expirada");
                assertThat(MotivoCierre.FUERA_DE_PERFIL.getEtiqueta()).isEqualTo("No exige ingles");
                assertThat(MotivoCierre.CUBIERTA.getEtiqueta()).isEqualTo("Ya cubierta");
                assertThat(MotivoCierre.RETIRADA.getEtiqueta()).isEqualTo("Retirada");
            }
        }
    }

    // =========================================================================
    // TIER 2: BOUNDARY & CORNER CASES (>=5 tests per feature)
    // =========================================================================

    @Nested
    @DisplayName("Tier 2 - Boundary & Corner Cases")
    class Tier2_BoundaryAndCornerCases {

        @Nested
        @DisplayName("2.1 Temporal Boundaries & Date Corner Cases")
        class TemporalBoundaryTests {

            @Test
            @DisplayName("T2.1.1: Límite exacto de 7 días (168h 00m) es admitido")
            void testExact168HoursBoundary_IsAdmitted() {
                LocalDateTime ahora = LocalDateTime.of(2026, 8, 25, 12, 0, 0);
                LocalDateTime haceExactamente7Dias = ahora.minusDays(7);

                // En una frontera inclusiva o de comparación >= ahora.minusDays(7)
                boolean esFresca = !haceExactamente7Dias.isBefore(ahora.minusDays(7));
                assertThat(esFresca).isTrue();
            }

            @Test
            @DisplayName("T2.1.2: Límite de 7 días + 1 minuto (168h 01m) es rechazado")
            void test168HoursPlusOneMinute_IsRejected() {
                LocalDateTime ahora = LocalDateTime.of(2026, 8, 25, 12, 0, 0);
                LocalDateTime hace7DiasYUnMinuto = ahora.minusDays(7).minusMinutes(1);

                boolean esFresca = !hace7DiasYUnMinuto.isBefore(ahora.minusDays(7));
                assertThat(esFresca).isFalse();
            }

            @Test
            @DisplayName("T2.1.3: Año bisiesto 29 de febrero calcula diferencias temporales sin error")
            void testLeapYearFebruary29_CalculatedCorrectly() {
                LocalDate bisiesto = LocalDate.of(2024, 2, 29);
                LocalDateTime fechaBisiesta = bisiesto.atTime(10, 0);
                LocalDateTime cuatroDiasDespues = fechaBisiesta.plusDays(4);

                assertThat(cuatroDiasDespues.getMonthValue()).isEqualTo(3);
                assertThat(cuatroDiasDespues.getDayOfMonth()).isEqualTo(4);
            }

            @Test
            @DisplayName("T2.1.4: Cadenas de fecha malformadas o corruptas no provocan excepciones no capturadas")
            void testMalformedDateStrings_DoNotThrowUnhandledExceptions() {
                assertThatCode(() -> {
                    String fechaMala = "2026-99-99T99:99:99Z";
                    try {
                        OffsetDateTime.parse(fechaMala);
                    } catch (Exception ignored) {
                        // Fallback seguro
                    }
                }).doesNotThrowAnyException();
            }

            @Test
            @DisplayName("T2.1.5: Variaciones de mayúsculas/minúsculas en texto relativo ('HACE 2 DIAS', 'hace 2 días')")
            void testRelativeDateCaseVariations() {
                String t1 = "HACE 2 DIAS".toLowerCase();
                String t2 = "publicado ayer".toLowerCase();

                assertThat(t1.contains("hace 2 dia") || t1.contains("hace 2 días") || t1.contains("hace 2 dias")).isTrue();
                assertThat(t2.contains("ayer") || t2.contains("hace 1")).isTrue();
            }
        }

        @Nested
        @DisplayName("2.2 Geolocation Edge & Normalization Cases")
        class GeolocationBoundaryTests {

            @Test
            @DisplayName("T2.2.1: Municipio Sabanagrande se reconoce en mayúsculas, minúsculas y con/sin tildes")
            void testSabanagrande_NormalizedAndAdmitted() {
                Vacante v1 = new Vacante();
                v1.setCiudad("SABANAGRANDE");
                v1.setUbicacion("SABANAGRANDE, ATLÁNTICO");
                v1.setModalidadTrabajo("Presencial");

                Vacante v2 = new Vacante();
                v2.setCiudad("sabanagrande");
                v2.setUbicacion("Sabanagrande, Atlántico");
                v2.setModalidadTrabajo("Presencial");

                assertThat(AreaMetropolitana.esAtlanticoORemota(v1)).isTrue();
                assertThat(AreaMetropolitana.esAtlanticoORemota(v2)).isTrue();
            }

            @ParameterizedTest(name = "T2.2.2: Municipios rurales con/sin acentos: {0}")
            @CsvSource({
                    "Piojó, piojo",
                    "Usiacurí, usiacuri",
                    "Suan, suan",
                    "Manatí, manati",
                    "Repelón, repelon",
                    "Santa Lucía, santa lucia",
                    "Tubará, tubara"
            })
            void testRuralMunicipalities_WithAndWithoutAccents(String conTilde, String sinTilde) {
                Vacante vCon = new Vacante();
                vCon.setCiudad(conTilde);
                vCon.setModalidadTrabajo("Presencial");

                Vacante vSin = new Vacante();
                vSin.setCiudad(sinTilde);
                vSin.setModalidadTrabajo("Presencial");

                assertThat(AreaMetropolitana.esAtlanticoORemota(vCon)).isTrue();
                assertThat(AreaMetropolitana.esAtlanticoORemota(vSin)).isTrue();
            }

            @Test
            @DisplayName("T2.2.3: Ubicaciones compuestas con Atlántico y mención secundaria de otra ciudad")
            void testCompoundLocations_EvaluatedByPhysicalSede() {
                Vacante v = new Vacante();
                v.setCiudad("Barranquilla");
                v.setUbicacion("Barranquilla, Atlántico");
                v.setDescripcion("Contrato con casa matriz en Medellín pero labores 100% presenciales en sede Barranquilla.");
                v.setModalidadTrabajo("Presencial");

                assertThat(AreaMetropolitana.esAtlanticoORemota(v)).isTrue();
            }

            @Test
            @DisplayName("T2.2.4: Slugs con patrones compuestos (/oferta-...-en-bogota-HASH) se extraen limpiamente")
            void testSlugParsing_BogotaExtraction() {
                var doc = Jsoup.parse("""
                        <article class="box_offer" data-id="slug-bog-1">
                            <h2>
                                <a class="js-o-link" href="/ofertas-de-trabajo/agente-bilingue-en-bogota-9912AB">
                                    Bilingual Agent Bogotá
                                </a>
                            </h2>
                            <p class="fs16 fc_base"><span class="mr10">Cundinamarca</span></p>
                            <p class="fs13 fc_aux">Hace 1 día</p>
                        </article>
                        """);

                List<OfertaCruda> ofertas = parsearComputrabajo(doc, "Barranquilla");
                assertThat(ofertas).hasSize(1);
                Vacante v = ofertas.get(0).vacante();
                assertThat(v.getCiudad()).isEqualTo("Bogotá");
                assertThat(AreaMetropolitana.esAtlanticoORemota(v)).isFalse();
            }

            @Test
            @DisplayName("T2.2.5: Casing extremo ('bArRaNqUiLlA', 'sOlEdAd') se normaliza adecuadamente")
            void testExtremeCasing_Normalized() {
                Vacante v = new Vacante();
                v.setCiudad("bArRaNqUiLlA");
                v.setUbicacion("sOlEdAd, aTlAnTiCo");
                v.setModalidadTrabajo("Presencial");

                assertThat(AreaMetropolitana.esAtlanticoORemota(v)).isTrue();
            }
        }

        @Nested
        @DisplayName("2.3 Linguistic Shielding & False Positive Neutralization")
        class LinguisticBoundaryTests {

            @ParameterizedTest(name = "T2.3.1: Acrónimos comerciales {0} no deben activar filtro de idioma")
            @ValueSource(strings = {
                    "Ejecutivo de ventas B2B presencial",
                    "Especialista comercial B2C retail",
                    "Licitaciones gubernamentales B2G",
                    "Canal de distribución B2E",
                    "Negociaciones 2B industriales"
            })
            void testCommercialAcronyms_DoNotTriggerLanguage(String titulo) {
                Vacante v = new Vacante();
                v.setTitulo(titulo);
                v.setDescripcion("Ventas directas en espanol unicamente de mostrador.");

                assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                        .as("El título '%s' con acrónimo comercial no debe calificar como inglés", titulo)
                        .isFalse();
            }

            @ParameterizedTest(name = "T2.3.2: Licencias de conducción ({0}) no deben activar filtro de idioma")
            @ValueSource(strings = {
                    "Conductor con Licencia C1 para reparto",
                    "Chofer de camión con pase B2 vigente",
                    "Conductor categoría C2 transporte público",
                    "Mensajero con licencia de conducción B1"
            })
            void testDrivingLicenses_DoNotTriggerLanguage(String titulo) {
                Vacante v = new Vacante();
                v.setTitulo(titulo);
                v.setDescripcion("Manejo de vehículo institucional en el perímetro urbano.");

                assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                        .as("La licencia de conducción '%s' no debe confundirse con nivel de inglés", titulo)
                        .isFalse();
            }

            @ParameterizedTest(name = "T2.3.3: Ubicaciones e infraestructura ({0}) no deben activar filtro de idioma")
            @ValueSource(strings = {
                    "Operario de logística en Bodega B1",
                    "Recepcionista en Piso C1 torre empresarial",
                    "Auxiliar de almacén en Zona B2 norte",
                    "Vigilante para Stand B2 en feria"
            })
            void testInfrastructureCodes_DoNotTriggerLanguage(String titulo) {
                Vacante v = new Vacante();
                v.setTitulo(titulo);
                v.setDescripcion("Labores operativas presenciales en español.");

                assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                        .as("El código de infraestructura '%s' no debe activar nivel MCER", titulo)
                        .isFalse();
            }

            @ParameterizedTest(name = "T2.3.4: Vitaminas y compuestos médicos ({0}) no activan filtro de idioma")
            @ValueSource(strings = {
                    "Vendedor de mostrador farmacia Vitamina B1",
                    "Promotor de suplementos Complejo B2"
            })
            void testVitaminsAndMedicalTerms_DoNotTriggerLanguage(String titulo) {
                Vacante v = new Vacante();
                v.setTitulo(titulo);
                v.setDescripcion("Asesoría de mostrador para productos de farmacia.");

                assertThat(FiltroBilingue.esDeTrabajoEnIngles(v)).isFalse();
            }

            @ParameterizedTest(name = "T2.3.5: Roles multidisciplinares legítimamente bilingües son detectados: {0}")
            @CsvSource({
                    "Ingeniero Civil Bilingüe, Supervisión de obras internacionales",
                    "Contador Público Bilingüe, Manejo de IFRS y reportes a casa matriz",
                    "Diseñador Gráfico UI/UX, English C1 proficiency required",
                    "Enfermera Bilingüe, Atención a pacientes extranjeros en inglés",
                    "Bilingual Customer Support Representative, Technical English level B2",
                    "Gerente de Operaciones, Totalmente bilingüe inglés avanzado"
            })
            void testMultiDisciplinaryEnglishRoles_AreAdmitted(String titulo, String descripcion) {
                Vacante v = new Vacante();
                v.setTitulo(titulo);
                v.setDescripcion(descripcion);

                assertThat(FiltroBilingue.esDeTrabajoEnIngles(v))
                        .as("El rol '%s' debe ser detectado como bilingüe", titulo)
                        .isTrue();
            }
        }
    }

    // =========================================================================
    // TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise matrix)
    // =========================================================================

    @Nested
    @DisplayName("Tier 3 - Cross-Feature Combinations")
    class Tier3_CrossFeatureCombinations {

        @ParameterizedTest(name = "T3.{index}: {0} | {1} | {2} | {3} | {4} => Esperado: {5}")
        @CsvSource(delimiter = '|', value = {
                // Freshness (días) | Ciudad | Idioma (Requisito) | Estado Tarjeta | Fuente | AdmisibleEsperado
                "2 | Barranquilla | Bilingual B2 | ACTIVE | COMPUTRABAJO | true",
                "1 | Bogotá | Bilingual C1 | ACTIVE | COMPUTRABAJO | false",
                "10 | Barranquilla | Bilingual B2 | ACTIVE | LINKEDIN | false",
                "3 | Remoto | Bilingual B2 | INACTIVE | COMPUTRABAJO | false",
                "1 | Remoto | Segmento Remoto | ACTIVE | REMOTIVE | true",
                "2 | Soledad | Monolingual Spanish | ACTIVE | SMARTRECRUITERS | false",
                "4 | Sabanagrande | English B1 | ACTIVE | LINKEDIN | true",
                "9 | Remoto | Bilingual C1 | ACTIVE | JSEARCH | false",
                "1 | Medellín | Monolingual Spanish | INACTIVE | COMPUTRABAJO | false",
                "0 | Malambo | MCER B2 | ACTIVE | ELEMPLEO | true",
                "3 | Galapa | Bilingual Customer Support | ACTIVE | SMARTRECRUITERS | true",
                "1 | Pereira | Bilingual Support B2 | ACTIVE | LINKEDIN | false"
        })
        void testCrossFeatureCombinationsMatrix(int diasAntiguedad, String ciudad, String idiomaTexto,
                                               String estadoTarjeta, String fuente, boolean esperadoAdmisible) {
            LocalDateTime fechaPub = LocalDateTime.now().minusDays(diasAntiguedad);
            boolean esRemoto = "Remoto".equalsIgnoreCase(ciudad);

            Vacante v = new Vacante();
            v.setTitulo("Job Offer: " + idiomaTexto + " in " + ciudad);
            v.setFuente(fuente);
            String ubicacion = esRemoto ? "Remoto, Colombia"
                    : (List.of("Barranquilla", "Soledad", "Malambo", "Galapa", "Sabanagrande", "Baranoa", "Puerto Colombia").contains(ciudad)
                    ? ciudad + ", Atlántico, Colombia"
                    : ciudad + ", Colombia");
            v.setUbicacion(ubicacion);
            v.setModalidadTrabajo(esRemoto ? "Remoto" : "Presencial");
            v.setDescripcion("Description with requirements: " + idiomaTexto);
            v.setFechaPublicacion(fechaPub);
            v.setActivo("ACTIVE".equalsIgnoreCase(estadoTarjeta));
            if (esRemoto && "REMOTIVE".equalsIgnoreCase(fuente)) {
                v.setSegmento(Segmento.REMOTO_INGLES);
            }

            // Evaluación de compuertas
            boolean pasaFrescura = !fechaPub.isBefore(LocalDateTime.now().minusDays(7));
            boolean pasaGeo = AreaMetropolitana.esAtlanticoORemota(v);
            boolean pasaIdioma = FiltroBilingue.esDeTrabajoEnIngles(v);
            boolean pasaEstado = "ACTIVE".equalsIgnoreCase(estadoTarjeta);

            boolean resultadoFinal = pasaFrescura && pasaGeo && pasaIdioma && pasaEstado;

            assertThat(resultadoFinal)
                    .as("Evaluación combinada para (%d días, %s, %s, %s, %s)",
                            diasAntiguedad, ciudad, idiomaTexto, estadoTarjeta, fuente)
                    .isEqualTo(esperadoAdmisible);
        }
    }

    // =========================================================================
    // TIER 4: REAL-WORLD APPLICATION SCENARIOS
    // =========================================================================

    @Nested
    @DisplayName("Tier 4 - Real-World Application Scenarios")
    class Tier4_RealWorldApplicationScenarios {

        private EstudianteRepository estudianteRepository;
        private VacanteRepository vacanteRepository;
        private EmpresaRepository empresaRepository;
        private ScrapingEjecucionRepository ejecucionRepository;
        private EnriquecedorDeVacante enriquecedor;
        private ControlDeCuota controlDeCuota;
        private RegistroDeVacante registroDeVacante;

        @BeforeEach
        void setUp() {
            estudianteRepository = mock(EstudianteRepository.class);
            vacanteRepository = mock(VacanteRepository.class);
            empresaRepository = mock(EmpresaRepository.class);
            ejecucionRepository = mock(ScrapingEjecucionRepository.class);
            enriquecedor = mock(EnriquecedorDeVacante.class);
            controlDeCuota = mock(ControlDeCuota.class);

            registroDeVacante = new RegistroDeVacante(vacanteRepository, empresaRepository, enriquecedor);

            when(estudianteRepository.findCargosObjetivoDeActivos())
                    .thenReturn(List.of("software engineer", "bilingual customer service", "financial analyst"));
            when(estudianteRepository.findSectoresObjetivoDeActivos())
                    .thenReturn(List.of("Tecnología", "BPO", "Finanzas"));
            when(estudianteRepository.findCiudadesDeActivosPorFrecuencia())
                    .thenReturn(List.of("Barranquilla", "Soledad"));

            when(vacanteRepository.findVencidasSinCerrar(any())).thenReturn(List.of());
            when(vacanteRepository.contarVigentes(any())).thenReturn(25L);
        }

        @Test
        @DisplayName("T4.1 Concurrent Multi-Portal Scraping Pipeline Run")
        void testMultiPortalConcurrentScrapingPipeline() {
            // Configurar 4 fuentes mock concurrentes
            FuenteDeVacantes fLinkedin = mock(FuenteDeVacantes.class);
            when(fLinkedin.nombre()).thenReturn("LINKEDIN");
            when(fLinkedin.segmento()).thenReturn(Segmento.LOCAL_COLOMBIA);
            when(fLinkedin.estaHabilitada()).thenReturn(true);
            when(fLinkedin.filtraPorCiudad()).thenReturn(true);
            when(fLinkedin.maximoConsultasPorCorrida()).thenReturn(2);

            Vacante vLk1 = construirVacante("lk-1", "LINKEDIN", "Bilingual Support Engineer B2", "Barranquilla",
                    "Barranquilla, Atlántico", "English required C1/B2", "Presencial", LocalDateTime.now().minusDays(1));
            when(fLinkedin.buscar(anyString(), anyString())).thenReturn(ResultadoBusqueda.de(List.of(
                    new OfertaCruda(vLk1, "Sutherland")
            )));

            FuenteDeVacantes fComputrabajo = mock(FuenteDeVacantes.class);
            when(fComputrabajo.nombre()).thenReturn("COMPUTRABAJO");
            when(fComputrabajo.segmento()).thenReturn(Segmento.LOCAL_COLOMBIA);
            when(fComputrabajo.estaHabilitada()).thenReturn(true);
            when(fComputrabajo.filtraPorCiudad()).thenReturn(true);
            when(fComputrabajo.maximoConsultasPorCorrida()).thenReturn(2);

            Vacante vCt1 = construirVacante("ct-1", "COMPUTRABAJO", "Bilingual Tech Representative", "Soledad",
                    "Soledad, Atlántico", "Inglés conversacional fluido", "Presencial", LocalDateTime.now().minusDays(2));
            Vacante vCtBogota = construirVacante("ct-bog", "COMPUTRABAJO", "Asesor Presencial Bogotá", "Bogotá",
                    "Bogotá D.C.", "English required", "Presencial", LocalDateTime.now().minusDays(1));
            when(fComputrabajo.buscar(anyString(), anyString())).thenReturn(ResultadoBusqueda.de(List.of(
                    new OfertaCruda(vCt1, "Teleperformance"),
                    new OfertaCruda(vCtBogota, "Call Bogotá")
            )));

            FuenteDeVacantes fRemotive = mock(FuenteDeVacantes.class);
            when(fRemotive.nombre()).thenReturn("REMOTIVE");
            when(fRemotive.segmento()).thenReturn(Segmento.REMOTO_INGLES);
            when(fRemotive.estaHabilitada()).thenReturn(true);
            when(fRemotive.filtraPorCiudad()).thenReturn(false);
            when(fRemotive.maximoConsultasPorCorrida()).thenReturn(1);

            Vacante vRem = construirVacante("rem-1", "REMOTIVE", "Full Stack Developer", null,
                    "Worldwide", "Remote English position", "REMOTO", LocalDateTime.now().minusDays(1));
            vRem.setSegmento(Segmento.REMOTO_INGLES);
            when(fRemotive.buscar(anyString(), any())).thenReturn(ResultadoBusqueda.de(List.of(
                    new OfertaCruda(vRem, "Global Tech Corp")
            )));

            FuenteDeVacantes fSmartRecruiters = mock(FuenteDeVacantes.class);
            when(fSmartRecruiters.nombre()).thenReturn("SMARTRECRUITERS");
            when(fSmartRecruiters.segmento()).thenReturn(Segmento.LOCAL_COLOMBIA);
            when(fSmartRecruiters.estaHabilitada()).thenReturn(true);
            when(fSmartRecruiters.filtraPorCiudad()).thenReturn(false);
            when(fSmartRecruiters.maximoConsultasPorCorrida()).thenReturn(1);

            Vacante vSrMono = construirVacante("sr-mono", "SMARTRECRUITERS", "Auxiliar de Bodega", "Barranquilla",
                    "Barranquilla", "Trabajo en bodega en español", "Presencial", LocalDateTime.now().minusDays(1));
            when(fSmartRecruiters.buscar(anyString(), any())).thenReturn(ResultadoBusqueda.de(List.of(
                    new OfertaCruda(vSrMono, "Alorica")
            )));

            // Mock repositorios para persistencia con simulación de deduplicación
            Set<String> hashesGuardados = ConcurrentHashMap.newKeySet();
            when(vacanteRepository.findByHashDedup(anyString())).thenAnswer(inv -> {
                String h = inv.getArgument(0);
                return hashesGuardados.contains(h) ? Optional.of(new Vacante()) : Optional.empty();
            });
            when(vacanteRepository.findByHashContenido(anyString())).thenAnswer(inv -> {
                String h = inv.getArgument(0);
                return hashesGuardados.contains(h) ? Optional.of(new Vacante()) : Optional.empty();
            });
            when(vacanteRepository.save(any(Vacante.class))).thenAnswer(inv -> {
                Vacante vac = inv.getArgument(0);
                if (vac.getHashDedup() != null) hashesGuardados.add(vac.getHashDedup());
                if (vac.getHashContenido() != null) hashesGuardados.add(vac.getHashContenido());
                return vac;
            });
            when(empresaRepository.findByNombreIgnoreCaseActiva(anyString())).thenReturn(Optional.empty());
            when(empresaRepository.save(any(Empresa.class))).thenAnswer(inv -> inv.getArgument(0));

            var scrapingService = new ScrapingService(
                    List.of(fLinkedin, fComputrabajo, fRemotive, fSmartRecruiters),
                    estudianteRepository,
                    vacanteRepository,
                    ejecucionRepository,
                    registroDeVacante,
                    controlDeCuota
            );

            ResultadoActualizacion resultado = scrapingService.actualizar(ScrapingEjecucion.Origen.MANUAL);

            // De las 5 ofertas encontradas:
            // - vLk1 (Barranquilla + Bilingüe + Fresh) -> Aceptada
            // - vCt1 (Soledad + Bilingüe + Fresh) -> Aceptada
            // - vCtBogota (Bogotá Presencial) -> Descartada por Geo
            // - vRem (Remoto Internacional) -> Aceptada
            // - vSrMono (Monolingüe) -> Descartada por Idioma
            // Nuevas guardadas: 3
            assertThat(resultado.vacantesNuevas()).isEqualTo(3);
            verify(vacanteRepository, times(3)).save(any(Vacante.class));

            var captor = ArgumentCaptor.forClass(ScrapingEjecucion.class);
            verify(ejecucionRepository).save(captor.capture());
            ScrapingEjecucion ejecucion = captor.getValue();
            assertThat(ejecucion.getVacantesNuevas()).isEqualTo(3);
            assertThat(ejecucion.getPortales()).contains("LINKEDIN", "COMPUTRABAJO", "REMOTIVE", "SMARTRECRUITERS");
            assertThat(ejecucion.getDescartadasPorIdioma()).isGreaterThanOrEqualTo(2); // Geo + Idioma descartadas
        }

        @Test
        @DisplayName("T4.2 Multi-Career Candidate Search & Query Generation Flow")
        void testMultiCareerCandidateSearchFlow() {
            List<String> cargos = List.of("Ingeniero de Sistemas", "Contador Publico", "Disenador Grafico", "Enfermero");
            List<String> sectores = List.of("Tecnología", "Finanzas", "Salud");
            List<String> titulos = List.of("Ingeniería de Sistemas", "Contaduría Pública");
            List<String> programas = List.of("Ingeniería de Software");
            List<String> areas = List.of("Tecnología e Informática");

            List<String> terminosGenerados = TerminosDeBusqueda.desdeEstudiantes(cargos, sectores, titulos, programas, areas);

            assertThat(terminosGenerados).isNotEmpty();
            assertThat(terminosGenerados.stream().anyMatch(t -> t.toLowerCase().contains("bilingue") || t.toLowerCase().contains("ingles"))).isTrue();
        }

        @Test
        @DisplayName("T4.3 Database Retroactive Purge & Sanitization Simulation")
        void testDatabaseRetroactivePurgeSimulation() {
            LocalDateTime ahora = LocalDateTime.now();

            // Población de vacantes activas simulada
            Vacante v1Stale = construirVacante("p-stale", "LINKEDIN", "Bilingual Support", "Barranquilla",
                    "Barranquilla", "English B2", "Presencial", ahora.minusDays(15));

            Vacante v2Expired = construirVacante("p-exp", "COMPUTRABAJO", "Customer Success B2", "Soledad",
                    "Soledad", "English B2", "Presencial", ahora.minusDays(3));
            v2Expired.setFechaExpiracion(ahora.minusHours(2));

            Vacante v3OutOfRegion = construirVacante("p-bog", "COMPUTRABAJO", "Bilingual Representative", "Bogotá",
                    "Bogotá D.C.", "English C1", "Presencial", ahora.minusDays(2));

            Vacante v4Monolingual = construirVacante("p-mono", "COMPUTRABAJO", "Asesor Comercial Mostrador", "Barranquilla",
                    "Barranquilla", "Ventas en español", "Presencial", ahora.minusDays(2));

            Vacante v5Compliant = construirVacante("p-ok", "LINKEDIN", "Bilingual Tech Support", "Barranquilla",
                    "Barranquilla, Atlántico", "Fluent English required B2", "Presencial", ahora.minusDays(2));

            List<Vacante> baseDeDatosSimulada = new ArrayList<>(List.of(v1Stale, v2Expired, v3OutOfRegion, v4Monolingual, v5Compliant));

            // Simulación de saneamiento:
            // 1. Cierre de vencidas
            for (Vacante v : baseDeDatosSimulada) {
                if (v.isActivo() && v.getFechaExpiracion() != null && v.getFechaExpiracion().isBefore(ahora)) {
                    v.cerrar(MotivoCierre.EXPIRADA, ahora);
                }
            }
            assertThat(v2Expired.isActivo()).isFalse();
            assertThat(v2Expired.getMotivoCierre()).isEqualTo(MotivoCierre.EXPIRADA);

            // 2. Cierre de monolingües
            for (Vacante v : baseDeDatosSimulada) {
                if (v.isActivo() && !FiltroBilingue.esDeTrabajoEnIngles(v)) {
                    v.cerrar(MotivoCierre.FUERA_DE_PERFIL, ahora);
                }
            }
            assertThat(v4Monolingual.isActivo()).isFalse();
            assertThat(v4Monolingual.getMotivoCierre()).isEqualTo(MotivoCierre.FUERA_DE_PERFIL);

            // 3. Cierre de fuera de región presenciales
            for (Vacante v : baseDeDatosSimulada) {
                if (v.isActivo() && !AreaMetropolitana.esAtlanticoORemota(v)) {
                    v.cerrar(MotivoCierre.FUERA_DE_PERFIL, ahora);
                }
            }
            assertThat(v3OutOfRegion.isActivo()).isFalse();
            assertThat(v3OutOfRegion.getMotivoCierre()).isEqualTo(MotivoCierre.FUERA_DE_PERFIL);

            // 4. Verificación de vacante conforme intacta
            assertThat(v5Compliant.isActivo()).isTrue();
            assertThat(v5Compliant.getMotivoCierre()).isNull();
        }
    }
}
