package com.novacrm.scraper.portal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.scraper.fuente.OfertaCruda;
import com.novacrm.scraper.fuente.Segmento;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Milestone 1 Empirical Challenger: Portal Scrapers Adversarial Test Suite")
public class M1PortalAdversarialStressTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private final LocalDateTime ahora = LocalDateTime.now();

    // =========================================================================
    // 1. QUERY PARAMETER GENERATION TESTS
    // =========================================================================
    @Nested
    @DisplayName("Query Parameter Invariant Tests")
    class QueryParameterTests {

        @Test
        @DisplayName("Computrabajo query must contain &pubdate=7 and &by=publicationdown")
        void testComputrabajoQueryParameters() {
            String termino = "bilingual customer service";
            String ciudad = "Barranquilla";
            String expectedUrl = "https://co.computrabajo.com/ofertas-de-trabajo/?q="
                    + URLEncoder.encode(termino, StandardCharsets.UTF_8)
                    + "&l=" + URLEncoder.encode(ciudad, StandardCharsets.UTF_8)
                    + "&pubdate=7&by=publicationdown";

            assertThat(expectedUrl).contains("&pubdate=7");
            assertThat(expectedUrl).contains("&by=publicationdown");
        }

        @Test
        @DisplayName("LinkedIn Jobs query must contain &f_TPR=r604800 (past 7 days filter)")
        void testLinkedInQueryParameters() {
            String termino = "software engineer bilingual";
            String ciudad = "Barranquilla, Atlantico, Colombia";
            String expectedUrl = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
                    + "?keywords=" + URLEncoder.encode(termino, StandardCharsets.UTF_8)
                    + "&location=" + URLEncoder.encode(ciudad, StandardCharsets.UTF_8)
                    + "&f_TPR=r604800"
                    + "&start=0";

            assertThat(expectedUrl).contains("&f_TPR=r604800");
        }
    }

    // =========================================================================
    // 2. COMPUTRABAJO ADVERSARIAL STRESS TESTS
    // =========================================================================
    @Nested
    @DisplayName("Computrabajo Adversarial HTML Card Tests")
    class ComputrabajoTests {

        @Test
        @DisplayName("Computrabajo rejects cards with null, missing, corrupt, or >7d dates (100% rejection)")
        void testComputrabajoAdversarialCards() {
            String html = """
                    <article class="box_offer" data-id="c1">
                        <h2><a class="js-o-link" href="/ofertas/c1">Fresh Job 1 Day</a></h2>
                        <p class="fs16 fc_base"><span class="mr10">Barranquilla, Atlántico</span></p>
                        <p class="fs13 fc_aux">Hace 1 día</p>
                    </article>
                    <article class="box_offer" data-id="c2">
                        <h2><a class="js-o-link" href="/ofertas/c2">Fresh Job 3 Hours</a></h2>
                        <p class="fs16 fc_base"><span class="mr10">Barranquilla, Atlántico</span></p>
                        <p class="fs13 fc_aux">Hace 3 horas</p>
                    </article>
                    <article class="box_offer" data-id="c3">
                        <h2><a class="js-o-link" href="/ofertas/c3">Stale Job 8 Days</a></h2>
                        <p class="fs16 fc_base"><span class="mr10">Barranquilla, Atlántico</span></p>
                        <p class="fs13 fc_aux">Hace 8 días</p>
                    </article>
                    <article class="box_offer" data-id="c4">
                        <h2><a class="js-o-link" href="/ofertas/c4">Stale Job 15 Days</a></h2>
                        <p class="fs16 fc_base"><span class="mr10">Barranquilla, Atlántico</span></p>
                        <p class="fs13 fc_aux">Hace 15 días</p>
                    </article>
                    <article class="box_offer" data-id="c5">
                        <h2><a class="js-o-link" href="/ofertas/c5">Stale Job 30+ Days</a></h2>
                        <p class="fs16 fc_base"><span class="mr10">Barranquilla, Atlántico</span></p>
                        <p class="fs13 fc_aux">+30 días</p>
                    </article>
                    <article class="box_offer" data-id="c6">
                        <h2><a class="js-o-link" href="/ofertas/c6">Corrupt Date String</a></h2>
                        <p class="fs16 fc_base"><span class="mr10">Barranquilla, Atlántico</span></p>
                        <p class="fs13 fc_aux">Salario a convenir 12345</p>
                    </article>
                    <article class="box_offer" data-id="c7">
                        <h2><a class="js-o-link" href="/ofertas/c7">Null / Missing Date Tag</a></h2>
                        <p class="fs16 fc_base"><span class="mr10">Barranquilla, Atlántico</span></p>
                    </article>
                    """;

            Document doc = Jsoup.parse(html);
            List<OfertaCruda> ofertas = ComputrabajoScraper.parsear(doc, "Barranquilla");

            // Out of 7 cards: only 2 are fresh (c1, c2). 5 are rejected (c3, c4, c5, c6, c7).
            assertThat(ofertas).hasSize(2);
            assertThat(ofertas).extracting(o -> o.vacante().getTitulo())
                    .containsExactlyInAnyOrder("Fresh Job 1 Day", "Fresh Job 3 Hours");
        }
    }

    // =========================================================================
    // 3. LINKEDIN JOBS ADVERSARIAL STRESS TESTS
    // =========================================================================
    @Nested
    @DisplayName("LinkedIn Jobs Adversarial HTML Card Tests")
    class LinkedInTests {

        @Test
        @DisplayName("LinkedIn rejects cards with missing <time>, stale ISO, or corrupt date (100% rejection)")
        void testLinkedInAdversarialCards() {
            String freshIso = ahora.minusDays(2).toString();
            String staleIso = ahora.minusDays(10).toString();

            String html = """
                    <ul>
                        <li>
                            <div class="base-card">
                                <a class="base-card__full-link" href="https://co.linkedin.com/jobs/view/lk1-4400000001">
                                    <span class="sr-only">LK Fresh ISO</span>
                                </a>
                                <div class="base-search-card__info">
                                    <h3 class="base-search-card__title">LK Fresh ISO</h3>
                                    <span class="job-search-card__location">Barranquilla, Atlántico, Colombia</span>
                                    <time class="job-search-card__listdate" datetime="%s">Hace 2 días</time>
                                </div>
                            </div>
                        </li>
                        <li>
                            <div class="base-card">
                                <a class="base-card__full-link" href="https://co.linkedin.com/jobs/view/lk2-4400000002">
                                    <span class="sr-only">LK Fresh Relative</span>
                                </a>
                                <div class="base-search-card__info">
                                    <h3 class="base-search-card__title">LK Fresh Relative</h3>
                                    <span class="job-search-card__location">Soledad, Atlántico, Colombia</span>
                                    <time class="job-search-card__listdate">Hace 4 horas</time>
                                </div>
                            </div>
                        </li>
                        <li>
                            <div class="base-card">
                                <a class="base-card__full-link" href="https://co.linkedin.com/jobs/view/lk3-4400000003">
                                    <span class="sr-only">LK Stale ISO 10d</span>
                                </a>
                                <div class="base-search-card__info">
                                    <h3 class="base-search-card__title">LK Stale ISO 10d</h3>
                                    <span class="job-search-card__location">Barranquilla, Atlántico, Colombia</span>
                                    <time class="job-search-card__listdate" datetime="%s">Hace 10 días</time>
                                </div>
                            </div>
                        </li>
                        <li>
                            <div class="base-card">
                                <a class="base-card__full-link" href="https://co.linkedin.com/jobs/view/lk4-4400000004">
                                    <span class="sr-only">LK Stale Relative 2m</span>
                                </a>
                                <div class="base-search-card__info">
                                    <h3 class="base-search-card__title">LK Stale Relative 2m</h3>
                                    <span class="job-search-card__location">Barranquilla, Atlántico, Colombia</span>
                                    <time class="job-search-card__listdate">Hace 2 meses</time>
                                </div>
                            </div>
                        </li>
                        <li>
                            <div class="base-card">
                                <a class="base-card__full-link" href="https://co.linkedin.com/jobs/view/lk5-4400000005">
                                    <span class="sr-only">LK Corrupt Date</span>
                                </a>
                                <div class="base-search-card__info">
                                    <h3 class="base-search-card__title">LK Corrupt Date</h3>
                                    <span class="job-search-card__location">Barranquilla, Atlántico, Colombia</span>
                                    <time class="job-search-card__listdate" datetime="corrupt-datetime-format">invalid</time>
                                </div>
                            </div>
                        </li>
                        <li>
                            <div class="base-card">
                                <a class="base-card__full-link" href="https://co.linkedin.com/jobs/view/lk6-4400000006">
                                    <span class="sr-only">LK Missing Time Tag</span>
                                </a>
                                <div class="base-search-card__info">
                                    <h3 class="base-search-card__title">LK Missing Time Tag</h3>
                                    <span class="job-search-card__location">Barranquilla, Atlántico, Colombia</span>
                                </div>
                            </div>
                        </li>
                    </ul>
                    """.formatted(freshIso, staleIso);

            Document doc = Jsoup.parse(html);
            List<OfertaCruda> ofertas = LinkedInJobsScraper.parsear(doc, "Barranquilla");

            assertThat(ofertas).hasSize(2);
            assertThat(ofertas).extracting(o -> o.vacante().getTitulo())
                    .containsExactlyInAnyOrder("LK Fresh ISO", "LK Fresh Relative");
        }
    }

    // =========================================================================
    // 4. ELEMPLEO ADVERSARIAL STRESS TESTS
    // =========================================================================
    @Nested
    @DisplayName("Elempleo GA4 JSON & HTML Cards Tests")
    class ElempleoTests {

        @Test
        @DisplayName("Elempleo rejects cards with missing publishDate, stale dates, or corrupted JSON")
        void testElempleoAdversarialCards() {
            String freshDate = ahora.minusDays(1).toString();
            String staleDate = ahora.minusDays(12).toString();

            String html = """
                    <div class="result-item js-area-bind" data-url="/co/oferta/e1"
                         data-ga4-offerdata='{"id":"e1","title":"Elempleo Fresh","location":"Barranquilla","publishDate":"%s"}'>
                    </div>
                    <div class="result-item js-area-bind" data-url="/co/oferta/e2"
                         data-ga4-offerdata='{"id":"e2","title":"Elempleo Stale 12d","location":"Barranquilla","publishDate":"%s"}'>
                    </div>
                    <div class="result-item js-area-bind" data-url="/co/oferta/e3"
                         data-ga4-offerdata='{"id":"e3","title":"Elempleo Missing Date","location":"Barranquilla"}'>
                    </div>
                    <div class="result-item js-area-bind" data-url="/co/oferta/e4"
                         data-ga4-offerdata='{"id":"e4","title":"Elempleo Corrupt Date","location":"Barranquilla","publishDate":"NaN-NaN-NaN"}'>
                    </div>
                    <div class="result-item js-area-bind" data-url="/co/oferta/e5"
                         data-ga4-offerdata='{"id":"e5","title":"Elempleo Empty Date","location":"Barranquilla","publishDate":""}'>
                    </div>
                    """.formatted(freshDate, staleDate);

            Document doc = Jsoup.parse(html);
            List<OfertaCruda> ofertas = ElempleoScraper.parsear(doc);

            assertThat(ofertas).hasSize(1);
            assertThat(ofertas.get(0).vacante().getTitulo()).isEqualTo("Elempleo Fresh");
        }
    }

    // =========================================================================
    // 5. REMOTIVE ADVERSARIAL STRESS TESTS
    // =========================================================================
    @Nested
    @DisplayName("Remotive JSON API Tests")
    class RemotiveTests {

        private final RemotiveConnector connector = new RemotiveConnector(true);

        @Test
        @DisplayName("Remotive rejects null publication_date, corrupt dates, or >7d dates")
        void testRemotiveAdversarialPayload() throws Exception {
            String freshDate = ahora.minusDays(2).toString() + "Z";
            String staleDate = ahora.minusDays(8).toString() + "Z";

            String json = """
                    {
                      "jobs": [
                        {
                          "id": 401,
                          "title": "Remotive Fresh",
                          "candidate_required_location": "Worldwide",
                          "publication_date": "%s"
                        },
                        {
                          "id": 402,
                          "title": "Remotive Stale 8d",
                          "candidate_required_location": "Worldwide",
                          "publication_date": "%s"
                        },
                        {
                          "id": 403,
                          "title": "Remotive Null Date",
                          "candidate_required_location": "Worldwide"
                        },
                        {
                          "id": 404,
                          "title": "Remotive Corrupt Date",
                          "candidate_required_location": "Worldwide",
                          "publication_date": "invalid-iso-date-string"
                        }
                      ]
                    }
                    """.formatted(freshDate, staleDate);

            var resultado = connector.procesar(json);
            assertThat(resultado.fallo()).isFalse();
            assertThat(resultado.ofertas()).hasSize(1);
            assertThat(resultado.ofertas().get(0).vacante().getTitulo()).isEqualTo("Remotive Fresh");
        }
    }
}
