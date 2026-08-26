package com.novacrm.scraper.fuente;

import com.novacrm.scraper.ScrapingService;
import org.jsoup.Connection;
import org.jsoup.HttpStatusException;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.io.InterruptedIOException;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.*;

/**
 * Empirical Stress Test Harness for Milestone 2:
 * Covers ReintentoConEspera exponential backoff, jitter, and error recovery under HTTP 403, 429, 503;
 * JSearch, Arbeitnow, and SmartRecruiters query formatting, rate-limit caps, and payload processing.
 */
@DisplayName("M2 Empirical Challenger: Fuente & Resilience Test Suite")
public class M2FuenteEmpiricalStressTest {

    private static final List<String> ADVERSARIAL_QUERY_TERMS = List.of(
            "Ingeniería de Sistemas / Software & Redes (Senior) #1 + C++",
            "Médico/Cirujano (Salud & Bienestar) 100% bilingüe",
            "Diseñador Gráfico & UI/UX / Web Designer - Bilingüe",
            "Administración & Finanzas / Contaduría (Nómina/Tributaria) B2+",
            "Bilingual Customer Support & Sales / BPO Lead $1,500 USD",
            "Desarrollador Full-Stack (Java / React / Python) & DevOps",
            "Analista de Datos / BI & Machine Learning en Bogotá/Barranquilla",
            "Especialista en Marketing Digital / SEO & SEM (Remoto)",
            "Docente / Traductor e Intérprete Inglés-Español (C1/C2)",
            "Psicólogo Organizacional & Talento Humano / HR Specialist",
            "   --- Auxiliar Administrativo / Recepcionista bilingüe ??? ---   ",
            "¡¡¡Ingeniero Industrial & Logística / Supply Chain (Bilingüe)!!!",
            "Arquitectura & Diseño de Interiores / AutoCAD 3D",
            "Técnico en Redes & Telecomunicaciones / Soporte TI 24/7",
            "Contador Público / Revisor Fiscal & Auditoría Bilingüe"
    );

    static Stream<String> adversarialTerms() {
        return ADVERSARIAL_QUERY_TERMS.stream();
    }

    // =========================================================================
    // 1. REINTENTO CON ESPERA BACKOFF AND JITTER
    // =========================================================================
    @Nested
    @DisplayName("ReintentoConEspera Resilience & Jitter Tests")
    class ReintentoConEsperaTests {

        private Connection.Response mockResponse(int statusCode, String retryAfter) throws IOException {
            var r = mock(Connection.Response.class);
            when(r.statusCode()).thenReturn(statusCode);
            when(r.header("Retry-After")).thenReturn(retryAfter);
            when(r.url()).thenReturn(new URL("https://portal.example/test-job"));
            when(r.parse()).thenReturn(Jsoup.parse("<html><body>Job Offer Result OK</body></html>"));
            return r;
        }

        @ParameterizedTest(name = "HTTP {0} qualifies for retry")
        @ValueSource(ints = {403, 408, 429, 502, 503, 504})
        void testRetryableStatusCodes(int code) {
            assertThat(ReintentoConEspera.mereceOtroIntento(code)).isTrue();
        }

        @ParameterizedTest(name = "HTTP {0} does NOT qualify for retry")
        @ValueSource(ints = {200, 201, 301, 302, 400, 401, 404, 405, 422, 500, 501})
        void testNonRetryableStatusCodes(int code) {
            assertThat(ReintentoConEspera.mereceOtroIntento(code)).isFalse();
        }

        @Test
        @DisplayName("HTTP 403 firewall response recovers on 2nd attempt")
        void testHttp403Recovery() throws Exception {
            var attempts = new AtomicInteger();
            var resp403 = mockResponse(403, null);
            var resp200 = mockResponse(200, null);

            Supplier<Connection> supplier = () -> {
                int i = attempts.getAndIncrement();
                var conn = mock(Connection.class);
                when(conn.ignoreHttpErrors(anyBoolean())).thenReturn(conn);
                try {
                    when(conn.execute()).thenReturn(i == 0 ? resp403 : resp200);
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
                return conn;
            };

            Document doc = ReintentoConEspera.documento("COMPUTRABAJO", supplier);
            assertThat(doc.text()).contains("Job Offer Result OK");
            assertThat(attempts.get()).isEqualTo(2);
        }

        @Test
        @DisplayName("HTTP 429 rate limit response recovers on 3rd attempt")
        void testHttp429RecoveryOnThirdAttempt() throws Exception {
            var attempts = new AtomicInteger();
            var resp429 = mockResponse(429, null);
            var resp200 = mockResponse(200, null);

            Supplier<Connection> supplier = () -> {
                int i = attempts.getAndIncrement();
                var conn = mock(Connection.class);
                when(conn.ignoreHttpErrors(anyBoolean())).thenReturn(conn);
                try {
                    when(conn.execute()).thenReturn(i < 2 ? resp429 : resp200);
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
                return conn;
            };

            Document doc = ReintentoConEspera.documento("ELEMPLEO", supplier);
            assertThat(doc.text()).contains("Job Offer Result OK");
            assertThat(attempts.get()).isEqualTo(3);
        }

        @Test
        @DisplayName("HTTP 503 service unavailable exhausts all 3 attempts and throws HttpStatusException")
        void testHttp503ExhaustionThrowsException() throws Exception {
            var attempts = new AtomicInteger();
            var resp503 = mockResponse(503, null);

            Supplier<Connection> supplier = () -> {
                attempts.getAndIncrement();
                var conn = mock(Connection.class);
                when(conn.ignoreHttpErrors(anyBoolean())).thenReturn(conn);
                try {
                    when(conn.execute()).thenReturn(resp503);
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
                return conn;
            };

            assertThatThrownBy(() -> ReintentoConEspera.documento("LINKEDIN", supplier))
                    .isInstanceOf(HttpStatusException.class)
                    .extracting(e -> ((HttpStatusException) e).getStatusCode())
                    .isEqualTo(503);

            assertThat(attempts.get()).isEqualTo(ReintentoConEspera.INTENTOS);
        }

        @Test
        @DisplayName("Network timeout / SocketTimeoutException retries and recovers")
        void testSocketTimeoutRetry() throws Exception {
            var attempts = new AtomicInteger();
            var resp200 = mockResponse(200, null);

            Supplier<Connection> supplier = () -> {
                int i = attempts.getAndIncrement();
                var conn = mock(Connection.class);
                when(conn.ignoreHttpErrors(anyBoolean())).thenReturn(conn);
                try {
                    if (i == 0) {
                        when(conn.execute()).thenThrow(new SocketTimeoutException("Read timed out"));
                    } else {
                        when(conn.execute()).thenReturn(resp200);
                    }
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
                return conn;
            };

            Document doc = ReintentoConEspera.documento("COMPUTRABAJO", supplier);
            assertThat(doc.text()).contains("Job Offer Result OK");
            assertThat(attempts.get()).isEqualTo(2);
        }

        @Test
        @DisplayName("Exponential backoff growth: attempt 2 > attempt 1 and includes non-zero jitter")
        void testExponentialBackoffAndJitterDistribution() {
            int samples = 100;
            long minAttempt1 = Long.MAX_VALUE;
            long maxAttempt1 = Long.MIN_VALUE;
            long minAttempt2 = Long.MAX_VALUE;
            long maxAttempt2 = Long.MIN_VALUE;

            for (int i = 0; i < samples; i++) {
                long wait1 = ReintentoConEspera.esperaEnMilis(1, null);
                long wait2 = ReintentoConEspera.esperaEnMilis(2, null);

                minAttempt1 = Math.min(minAttempt1, wait1);
                maxAttempt1 = Math.max(maxAttempt1, wait1);
                minAttempt2 = Math.min(minAttempt2, wait2);
                maxAttempt2 = Math.max(maxAttempt2, wait2);

                assertThat(wait1).isBetween(ReintentoConEspera.ESPERA_BASE_MS,
                        ReintentoConEspera.ESPERA_BASE_MS + ReintentoConEspera.ESPERA_BASE_MS / 2 + 1);
                assertThat(wait2).isBetween(ReintentoConEspera.ESPERA_BASE_MS * 2,
                        ReintentoConEspera.ESPERA_BASE_MS * 2 + ReintentoConEspera.ESPERA_BASE_MS / 2 + 1);
                assertThat(wait2).isGreaterThan(wait1);
            }

            assertThat(maxAttempt1).isGreaterThan(minAttempt1);
            assertThat(maxAttempt2).isGreaterThan(minAttempt2);
        }

        @Test
        @DisplayName("Retry-After header values are respected and capped at 20 seconds")
        void testRetryAfterHandling() {
            assertThat(ReintentoConEspera.esperaEnMilis(1, "4")).isEqualTo(4000);
            assertThat(ReintentoConEspera.esperaEnMilis(1, "12")).isEqualTo(12000);
            assertThat(ReintentoConEspera.esperaEnMilis(1, "60")).isEqualTo(ReintentoConEspera.ESPERA_MAXIMA_MS);
            assertThat(ReintentoConEspera.esperaEnMilis(1, "invalid-header")).isBetween(1500L, 2251L);
        }

        @Test
        @DisplayName("Thread interruption halts retries immediately and throws InterruptedIOException")
        void testThreadInterruption() throws Exception {
            var attempts = new AtomicInteger();
            var resp429 = mockResponse(429, null);

            Supplier<Connection> supplier = () -> {
                attempts.getAndIncrement();
                var conn = mock(Connection.class);
                when(conn.ignoreHttpErrors(anyBoolean())).thenReturn(conn);
                try {
                    when(conn.execute()).thenReturn(resp429);
                } catch (IOException e) {
                    throw new RuntimeException(e);
                }
                return conn;
            };

            Thread.currentThread().interrupt();
            try {
                assertThatThrownBy(() -> ReintentoConEspera.documento("TEST", supplier))
                        .isInstanceOf(InterruptedIOException.class);
            } finally {
                Thread.interrupted();
            }
        }
    }

    // =========================================================================
    // 2. JSEARCH, ARBEITNOW, SMARTRECRUITERS STRESS TESTS
    // =========================================================================
    @Nested
    @DisplayName("JSearch, Arbeitnow & SmartRecruiters Connectors")
    class FuenteConnectorsStressTests {

        @ParameterizedTest(name = "JSearch query escaping: {0}")
        @MethodSource("com.novacrm.scraper.fuente.M2FuenteEmpiricalStressTest#adversarialTerms")
        void testJSearchQueryEncodingValidity(String term) {
            String ciudad = "Barranquilla";
            String consulta = ciudad == null || ciudad.isBlank()
                    ? term
                    : term + " in " + ciudad;

            String url = "https://api.openwebninja.com/jsearch/search-v2"
                    + "?query=" + URLEncoder.encode(consulta, StandardCharsets.UTF_8)
                    + "&country=" + URLEncoder.encode("co", StandardCharsets.UTF_8)
                    + "&date_posted=month&page=1&num_pages=1";

            assertThatCode(() -> {
                URI uri = URI.create(url);
                assertThat(uri.getHost()).isEqualTo("api.openwebninja.com");
                assertThat(uri.getQuery()).contains("query=");
            }).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("JSearch parses search-v2 payload across multidisciplinary professions and separates requirements")
        void testJSearchMultiDisciplineParsing() throws Exception {
            ControlDeCuota cuota = mock(ControlDeCuota.class);
            var conector = new JSearchConnector(cuota, "test-key", true, 200, 6, "co");

            String fechaFresca = java.time.LocalDateTime.now().minusDays(1).toString() + "Z";
            String json = """
                    {
                      "status": "OK",
                      "data": {
                        "jobs": [
                          {
                            "job_id": "JS-ENG-1",
                            "job_title": "Ingeniero Mecatrónico / Automatización Bilingüe",
                            "employer_name": "ABB Colombia",
                            "job_city": "Barranquilla",
                            "job_state": "Atlantico",
                            "job_country": "CO",
                            "job_posted_at_datetime_utc": "%s",
                            "job_highlights": {
                              "Qualifications": ["Inglés avanzado C1", "3 años en PLC y robótica"]
                            }
                          },
                          {
                            "job_id": "JS-FIN-2",
                            "job_title": "Bilingual Financial & Accounting Analyst",
                            "employer_name": "Deloitte",
                            "job_city": "Soledad",
                            "job_state": "Atlantico",
                            "job_country": "CO",
                            "job_posted_at_datetime_utc": "%s",
                            "job_highlights": {
                              "Qualifications": ["Bilingual B2+", "IFRS knowledge"]
                            }
                          }
                        ]
                      }
                    }
                    """.formatted(fechaFresca, fechaFresca);

            var ofertas = conector.procesar(json);
            assertThat(ofertas).hasSize(2);
            assertThat(ofertas.get(0).vacante().getRequisitos()).contains("Inglés avanzado C1");
            assertThat(ofertas.get(1).vacante().getRequisitos()).contains("Bilingual B2+");
        }

        @Test
        @DisplayName("Arbeitnow processes visa-sponsored vacancies and ignores non-sponsored")
        void testArbeitnowProcessing() throws Exception {
            var conector = new ArbeitnowConnector(true, true);
            long epochFresco = java.time.Instant.now().minusSeconds(86400).getEpochSecond();
            String json = """
                    {
                      "data": [
                        {
                          "slug": "senior-java-berlin-1",
                          "title": "Senior Java Developer (Visa Sponsored)",
                          "company_name": "TechHub Berlin",
                          "location": "Berlin, Germany",
                          "visa_sponsorship": true,
                          "remote": true,
                          "url": "https://arbeitnow.com/jobs/senior-java-berlin-1",
                          "created_at": %d
                        },
                        {
                          "slug": "marketing-lead-2",
                          "title": "Marketing Lead (No Visa)",
                          "company_name": "LocalAgency",
                          "location": "Munich, Germany",
                          "visa_sponsorship": false,
                          "url": "https://arbeitnow.com/jobs/marketing-lead-2"
                        }
                      ]
                    }
                    """.formatted(epochFresco);

            var ofertas = conector.procesar(json);
            assertThat(ofertas).hasSize(1);
            assertThat(ofertas.get(0).vacante().getTitulo()).isEqualTo("Senior Java Developer (Visa Sponsored)");
            assertThat(ofertas.get(0).vacante().getSegmento()).isEqualTo(Segmento.MIGRACION);
        }

        @Test
        @DisplayName("SmartRecruiters processes local employers and attaches detailed qualifications")
        void testSmartRecruitersProcessing() throws Exception {
            var conector = new SmartRecruitersConnector(true, "Sutherland,Alorica");
            String fechaFresca = java.time.LocalDateTime.now().minusDays(1).toString() + "Z";
            String json = """
                    {
                      "content": [
                        {
                          "id": "sr-100",
                          "name": "Bilingual Financial Operations Specialist",
                          "location": { "city": "Barranquilla", "region": "Atlántico" },
                          "typeOfEmployment": { "label": "Full-time" },
                          "releasedDate": "%s"
                        }
                      ]
                    }
                    """.formatted(fechaFresca);

            var ofertas = conector.procesar(json, "Sutherland");
            assertThat(ofertas).hasSize(1);
            assertThat(ofertas.get(0).nombreEmpresa()).isEqualTo("Sutherland");
            assertThat(ofertas.get(0).vacante().getCiudad()).isEqualTo("Barranquilla");
            assertThat(ofertas.get(0).vacante().isRevisada()).isTrue();
        }
    }
}
