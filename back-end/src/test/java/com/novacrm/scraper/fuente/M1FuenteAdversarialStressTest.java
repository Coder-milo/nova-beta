package com.novacrm.scraper.fuente;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@DisplayName("Milestone 1 Empirical Challenger: Global Connectors & Freshness Filter Adversarial Test Suite")
public class M1FuenteAdversarialStressTest {

    private final LocalDateTime ahora = LocalDateTime.now();

    // =========================================================================
    // 1. JSEARCH QUERY PARAMETERS
    // =========================================================================
    @Nested
    @DisplayName("JSearch Query Parameter Verification")
    class JSearchQueryParams {

        @Test
        @DisplayName("JSearch query generation uses &date_posted=week strictly")
        void testJSearchQueryParameters() {
            String consulta = "call center in Barranquilla";
            String url = "https://api.openwebninja.com/jsearch/search-v2"
                    + "?query=" + URLEncoder.encode(consulta, StandardCharsets.UTF_8)
                    + "&country=" + URLEncoder.encode("co", StandardCharsets.UTF_8)
                    + "&date_posted=week&page=1&num_pages=1";

            assertThat(url).contains("&date_posted=week");
            assertThat(url).doesNotContain("date_posted=month");
        }
    }

    // =========================================================================
    // 2. SMARTRECRUITERS ADVERSARIAL STRESS TESTS
    // =========================================================================
    @Nested
    @DisplayName("SmartRecruiters JSON API Tests")
    class SmartRecruitersTests {

        private final SmartRecruitersConnector connector = new SmartRecruitersConnector(true, "Sutherland");

        @Test
        @DisplayName("SmartRecruiters rejects null releasedDate, corrupt dates, or >7d dates")
        void testSmartRecruitersAdversarialPayload() throws Exception {
            String freshDate = ahora.minusDays(1).toString() + "Z";
            String staleDate = ahora.minusDays(14).toString() + "Z";

            String json = """
                    {
                      "content": [
                        {
                          "id": "sr-fresh",
                          "name": "SR Fresh Job",
                          "location": { "city": "Barranquilla", "region": "Atlántico" },
                          "releasedDate": "%s"
                        },
                        {
                          "id": "sr-stale",
                          "name": "SR Stale Job",
                          "location": { "city": "Barranquilla", "region": "Atlántico" },
                          "releasedDate": "%s"
                        },
                        {
                          "id": "sr-null",
                          "name": "SR Null Date",
                          "location": { "city": "Barranquilla", "region": "Atlántico" }
                        },
                        {
                          "id": "sr-corrupt",
                          "name": "SR Corrupt Date",
                          "location": { "city": "Barranquilla", "region": "Atlántico" },
                          "releasedDate": "not-a-valid-date"
                        }
                      ]
                    }
                    """.formatted(freshDate, staleDate);

            List<OfertaCruda> ofertas = connector.procesar(json, "Sutherland");
            assertThat(ofertas).hasSize(1);
            assertThat(ofertas.get(0).vacante().getTitulo()).isEqualTo("SR Fresh Job");
        }
    }

    // =========================================================================
    // 3. ARBEITNOW ADVERSARIAL STRESS TESTS
    // =========================================================================
    @Nested
    @DisplayName("Arbeitnow JSON API Tests")
    class ArbeitnowTests {

        private final ArbeitnowConnector connector = new ArbeitnowConnector(true, false);

        @Test
        @DisplayName("Arbeitnow rejects null created_at, epoch 0, corrupt epoch, or >7d epoch")
        void testArbeitnowAdversarialPayload() throws Exception {
            long freshEpoch = Instant.now().minusSeconds(86400).getEpochSecond();
            long staleEpoch = Instant.now().minusSeconds(10 * 86400).getEpochSecond();
            long epochZero = 0L;

            String json = """
                    {
                      "data": [
                        {
                          "slug": "arb-fresh",
                          "title": "Arbeitnow Fresh",
                          "created_at": %d
                        },
                        {
                          "slug": "arb-stale",
                          "title": "Arbeitnow Stale",
                          "created_at": %d
                        },
                        {
                          "slug": "arb-zero",
                          "title": "Arbeitnow Epoch 0",
                          "created_at": %d
                        },
                        {
                          "slug": "arb-null",
                          "title": "Arbeitnow Null CreatedAt"
                        },
                        {
                          "slug": "arb-corrupt",
                          "title": "Arbeitnow Corrupt CreatedAt",
                          "created_at": "not-a-number"
                        }
                      ]
                    }
                    """.formatted(freshEpoch, staleEpoch, epochZero);

            List<OfertaCruda> ofertas = connector.procesar(json);
            assertThat(ofertas).hasSize(1);
            assertThat(ofertas.get(0).vacante().getTitulo()).isEqualTo("Arbeitnow Fresh");
        }
    }

    // =========================================================================
    // 4. JSEARCH ADVERSARIAL STRESS TESTS
    // =========================================================================
    @Nested
    @DisplayName("JSearch JSON API Tests")
    class JSearchTests {

        private final ControlDeCuota cuota = mock(ControlDeCuota.class);
        private final JSearchConnector connector;

        public JSearchTests() {
            when(cuota.intentarConsumir(anyString(), anyInt())).thenReturn(true);
            connector = new JSearchConnector(cuota, "test-key", true, 200, 6, "co");
        }

        @Test
        @DisplayName("JSearch rejects null date, corrupt datetime/timestamp, or >7d dates")
        void testJSearchAdversarialPayload() throws Exception {
            String freshIso = ahora.minusDays(2).toString() + "Z";
            String staleIso = ahora.minusDays(20).toString() + "Z";
            long freshEpoch = Instant.now().minusSeconds(2 * 86400).getEpochSecond();
            long staleEpoch = Instant.now().minusSeconds(15 * 86400).getEpochSecond();

            String json = """
                    {
                      "status": "OK",
                      "data": {
                        "jobs": [
                          {
                            "job_id": "js-fresh-iso",
                            "job_title": "JSearch Fresh ISO",
                            "job_posted_at_datetime_utc": "%s"
                          },
                          {
                            "job_id": "js-fresh-epoch",
                            "job_title": "JSearch Fresh Epoch Fallback",
                            "job_posted_at_timestamp": %d
                          },
                          {
                            "job_id": "js-stale-iso",
                            "job_title": "JSearch Stale ISO",
                            "job_posted_at_datetime_utc": "%s"
                          },
                          {
                            "job_id": "js-stale-epoch",
                            "job_title": "JSearch Stale Epoch",
                            "job_posted_at_timestamp": %d
                          },
                          {
                            "job_id": "js-null",
                            "job_title": "JSearch Null Date"
                          },
                          {
                            "job_id": "js-corrupt",
                            "job_title": "JSearch Corrupt ISO",
                            "job_posted_at_datetime_utc": "invalid-datetime"
                          }
                        ]
                      }
                    }
                    """.formatted(freshIso, freshEpoch, staleIso, staleEpoch);

            List<OfertaCruda> ofertas = connector.procesar(json);
            assertThat(ofertas).hasSize(2);
            assertThat(ofertas).extracting(o -> o.vacante().getTitulo())
                    .containsExactlyInAnyOrder("JSearch Fresh ISO", "JSearch Fresh Epoch Fallback");
        }
    }

    // =========================================================================
    // 5. FILTRO FRESCURA BOUNDARIES & TIMEZONE TESTS
    // =========================================================================
    @Nested
    @DisplayName("FiltroFrescura & ParserFechas Stress Tests")
    class FiltroFrescuraTests {

        @Test
        @DisplayName("FiltroFrescura rejects dates strictly > 7 days or null")
        void testFiltroFrescuraBoundaries() {
            assertThat(FiltroFrescura.esFresca(ahora, ahora)).isTrue();
            assertThat(FiltroFrescura.esFresca(ahora.minusDays(7), ahora)).isTrue();
            assertThat(FiltroFrescura.esFresca(ahora.minusDays(7).minusSeconds(1), ahora)).isFalse();
            assertThat(FiltroFrescura.esFresca(ahora.minusDays(8), ahora)).isFalse();
            assertThat(FiltroFrescura.esFresca((LocalDateTime) null, ahora)).isFalse();
        }

        @Test
        @DisplayName("FiltroFrescura tolerates UTC timezone skew (+1 day max)")
        void testUtcTolerance() {
            assertThat(FiltroFrescura.esFresca(ahora.plusHours(12), ahora)).isTrue();
            assertThat(FiltroFrescura.esFresca(ahora.plusDays(1), ahora)).isTrue();
            assertThat(FiltroFrescura.esFresca(ahora.plusDays(1).plusSeconds(1), ahora)).isFalse();
        }
    }
}
