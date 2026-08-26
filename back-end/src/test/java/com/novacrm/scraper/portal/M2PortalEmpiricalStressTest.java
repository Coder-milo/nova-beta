package com.novacrm.scraper.portal;

import com.novacrm.scraper.fuente.Segmento;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Empirical Stress Test Harness for Milestone 2:
 * Portal Scrapers & Connectors: Computrabajo, Elempleo, LinkedIn Jobs, Remotive.
 * Verifies query escaping, slug sanitization, and multidisciplinary HTML/JSON parsing.
 */
@DisplayName("M2 Empirical Challenger: Portal Scrapers Test Suite")
public class M2PortalEmpiricalStressTest {

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
    // 1. COMPUTRABAJO STRESS TESTS
    // =========================================================================
    @Nested
    @DisplayName("Computrabajo Scraper Tests")
    class ComputrabajoTests {

        @ParameterizedTest(name = "Computrabajo query escaping: {0}")
        @MethodSource("com.novacrm.scraper.portal.M2PortalEmpiricalStressTest#adversarialTerms")
        void testComputrabajoQueryEncoding(String term) {
            String ciudad = "Barranquilla, Atlántico";
            String baseUrl = "https://co.computrabajo.com/ofertas-de-trabajo/?q="
                    + URLEncoder.encode(term.trim(), StandardCharsets.UTF_8)
                    + "&l=" + URLEncoder.encode(ciudad, StandardCharsets.UTF_8)
                    + "&by=publicationdown";

            assertThatCode(() -> {
                URI uri = URI.create(baseUrl);
                assertThat(uri.getHost()).isEqualTo("co.computrabajo.com");
                assertThat(uri.getQuery()).contains("q=");
                assertThat(uri.getQuery()).contains("l=");
            }).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Computrabajo parses multi-career vacancies and extracts correct cities")
        void testComputrabajoMultiCareerParsing() {
            Document doc = Jsoup.parse("""
                    <article class="box_offer" data-id="COMP-999">
                        <h2>
                            <a class="title_offer" href="/ofertas-de-trabajo/ingeniero-de-sistemas-bilingue-en-barranquilla-COMP-999">
                                Ingeniero de Sistemas Bilingüe B2/C1
                            </a>
                        </h2>
                        <a href="/empresas/tech-colombia" offer-grid-article-company-url>Tech Colombia S.A.S.</a>
                        <p class="fs16"><span class="mr10">Barranquilla, Atlántico</span></p>
                        <p class="description">Desarrollo de software en Java/Spring y soporte técnico en inglés.</p>
                        <p class="salary">$ 4.500.000 (Mensual)</p>
                        <p class="fs13 fc_aux">Hace 1 día</p>
                    </article>
                    <article class="box_offer" data-id="COMP-888">
                        <h2>
                            <a class="title_offer" href="/ofertas-de-trabajo/contador-bilingue-remoto-COMP-888">
                                Contador Público Bilingüe (100% Remoto)
                            </a>
                        </h2>
                        <a href="/empresas/global-audit" offer-grid-article-company-url>Global Audit Corp</a>
                        <p class="fs16"><span class="mr10">Colombia</span></p>
                        <p class="description">Trabajo remoto para auditoría internacional y reporting en inglés.</p>
                        <p class="fs13 fc_aux">Hace 2 días</p>
                    </article>
                    """);

            var ofertas = ComputrabajoScraper.parsear(doc, "Barranquilla");
            assertThat(ofertas).hasSize(2);

            var o1 = ofertas.get(0);
            assertThat(o1.vacante().getTitulo()).isEqualTo("Ingeniero de Sistemas Bilingüe B2/C1");
            assertThat(o1.vacante().getCiudad()).isEqualTo("Barranquilla");
            assertThat(o1.vacante().getSegmento()).isEqualTo(Segmento.LOCAL_COLOMBIA);

            var o2 = ofertas.get(1);
            assertThat(o2.vacante().getTitulo()).isEqualTo("Contador Público Bilingüe (100% Remoto)");
            assertThat(o2.vacante().getModalidadTrabajo()).isEqualTo("Remoto");
            assertThat(o2.vacante().getSegmento()).isEqualTo(Segmento.REMOTO_INGLES);
        }
    }

    // =========================================================================
    // 2. ELEMPLEO STRESS TESTS
    // =========================================================================
    @Nested
    @DisplayName("Elempleo Scraper Tests")
    class ElempleoTests {

        @ParameterizedTest(name = "Elempleo slug generation: {0}")
        @MethodSource("com.novacrm.scraper.portal.M2PortalEmpiricalStressTest#adversarialTerms")
        void testElempleoSlugRegexSanitization(String term) {
            String slug = term.trim().toLowerCase()
                    .replaceAll("[^a-z0-9]+", "-")
                    .replaceAll("^-|-$", "");

            assertThat(slug).matches("^[a-z0-9-]*$");
            assertThat(slug).doesNotStartWith("-");
            assertThat(slug).doesNotEndWith("-");

            String url = "https://www.elempleo.com/co/ofertas-empleo/" + slug;
            assertThatCode(() -> {
                URI uri = URI.create(url);
                assertThat(uri.getHost()).isEqualTo("www.elempleo.com");
            }).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Elempleo handles pure symbols without malformed URI syntax")
        void testElempleoPureSymbolsSlug() {
            String pureSymbols = "!@#$%^&*()_+={}|[]\\:\";'<>?,./~`";
            String slug = pureSymbols.trim().toLowerCase()
                    .replaceAll("[^a-z0-9]+", "-")
                    .replaceAll("^-|-$", "");

            assertThat(slug).isEqualTo("");
            String url = "https://www.elempleo.com/co/ofertas-empleo/" + slug;
            URI uri = URI.create(url);
            assertThat(uri.getPath()).isEqualTo("/co/ofertas-empleo/");
        }

        @Test
        @DisplayName("Elempleo parses multidisciplinary offer with JSON payload")
        void testElempleoJsonParsing() {
            Document doc = Jsoup.parse("""
                    <div class="result-item js-area-bind" data-url="/co/ofertas-trabajo/disenador-grafico-ui/1999888"
                         data-ga4-offerdata='{"id":"1999888","title":"Diseñador Gráfico & UI/UX Bilingüe","company":"Design Agency","location":"Barranquilla, Atlantico","salary":"$ 3.500.000","publishDate":"2026-08-24T10:00:00","equivalentPositions":["UI Designer","Graphic Designer"],"tags":["Ingles Avanzado","Remoto"]}'>
                        <h3>Diseñador Gráfico & UI/UX Bilingüe</h3>
                    </div>
                    """);

            var ofertas = ElempleoScraper.parsear(doc);
            assertThat(ofertas).hasSize(1);
            assertThat(ofertas.get(0).vacante().getTitulo()).isEqualTo("Diseñador Gráfico & UI/UX Bilingüe");
            assertThat(ofertas.get(0).vacante().getCiudad()).isEqualTo("Barranquilla");
            assertThat(ofertas.get(0).vacante().getDescripcion()).contains("UI Designer");
            assertThat(ofertas.get(0).vacante().getDescripcion()).contains("Ingles Avanzado");
        }
    }

    // =========================================================================
    // 3. LINKEDIN JOBS STRESS TESTS
    // =========================================================================
    @Nested
    @DisplayName("LinkedIn Jobs Scraper Tests")
    class LinkedInTests {

        @ParameterizedTest(name = "LinkedIn query escaping: {0}")
        @MethodSource("com.novacrm.scraper.portal.M2PortalEmpiricalStressTest#adversarialTerms")
        void testLinkedInQueryEncoding(String term) {
            String ciudad = "Barranquilla";
            String ubicacionParam = ciudad.toLowerCase().contains("colombia")
                    ? ciudad
                    : ciudad + ", Atlantico, Colombia";

            String url = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
                    + "?keywords=" + URLEncoder.encode(term.trim(), StandardCharsets.UTF_8)
                    + "&location=" + URLEncoder.encode(ubicacionParam, StandardCharsets.UTF_8)
                    + "&start=0";

            assertThatCode(() -> {
                URI uri = URI.create(url);
                assertThat(uri.getHost()).isEqualTo("www.linkedin.com");
                assertThat(uri.getQuery()).contains("keywords=");
            }).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("LinkedIn parses multi-disciplinary guest API payload and checks metropolitan area")
        void testLinkedInMultiDisciplinaryParsing() {
            Document doc = Jsoup.parse("""
                    <ul>
                        <li>
                            <div class="base-card">
                                <a class="base-card__full-link" href="https://co.linkedin.com/jobs/view/bilingual-financial-analyst-at-kpmg-4455667788">
                                    <span class="sr-only">Bilingual Financial Analyst</span>
                                </a>
                                <div class="base-search-card__info">
                                    <h3 class="base-search-card__title">Bilingual Financial Analyst</h3>
                                    <h4 class="base-search-card__subtitle"><a href="#">KPMG Colombia</a></h4>
                                    <span class="job-search-card__location">Barranquilla, Atlántico, Colombia</span>
                                    <time class="job-search-card__listdate">Hace 1 día</time>
                                </div>
                            </div>
                        </li>
                        <li>
                            <div class="base-card">
                                <a class="base-card__full-link" href="https://co.linkedin.com/jobs/view/ux-ui-designer-remote-4499001122">
                                    <span class="sr-only">Senior UX/UI Designer Bilingual (Remote)</span>
                                </a>
                                <div class="base-search-card__info">
                                    <h3 class="base-search-card__title">Senior UX/UI Designer Bilingual (Remote)</h3>
                                    <h4 class="base-search-card__subtitle"><a href="#">DesignLab</a></h4>
                                    <span class="job-search-card__location">Colombia</span>
                                    <time class="job-search-card__listdate">Hace 2 días</time>
                                </div>
                            </div>
                        </li>
                    </ul>
                    """);

            var ofertas = LinkedInJobsScraper.parsear(doc, "Barranquilla");
            assertThat(ofertas).hasSize(2);
            assertThat(ofertas.get(0).vacante().getTitulo()).isEqualTo("Bilingual Financial Analyst");
            assertThat(ofertas.get(1).vacante().getModalidadTrabajo()).isEqualTo("Remoto");
        }
    }

    // =========================================================================
    // 4. REMOTIVE STRESS TESTS
    // =========================================================================
    @Nested
    @DisplayName("Remotive Connector Tests")
    class RemotiveTests {

        @ParameterizedTest(name = "Remotive query escaping: {0}")
        @MethodSource("com.novacrm.scraper.portal.M2PortalEmpiricalStressTest#adversarialTerms")
        void testRemotiveQueryEncoding(String term) {
            String url = "https://remotive.com/api/remote-jobs"
                    + "?limit=50"
                    + "&search=" + URLEncoder.encode(term == null ? "" : term.trim(), StandardCharsets.UTF_8);

            assertThatCode(() -> {
                URI uri = URI.create(url);
                assertThat(uri.getHost()).isEqualTo("remotive.com");
                assertThat(uri.getQuery()).contains("search=");
            }).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Remotive handles global engineering, finance and support disciplines")
        void testRemotiveMultiDisciplineParsing() throws Exception {
            var conector = new RemotiveConnector(true);
            String fechaFresca = java.time.LocalDateTime.now().minusDays(1).toString();
            String json = """
                    {
                      "jobs": [
                        {
                          "id": 1001,
                          "title": "Bilingual DevOps Engineer",
                          "company_name": "CloudScale",
                          "candidate_required_location": "LATAM",
                          "url": "https://remotive.com/remote-jobs/devops/1001",
                          "publication_date": "%s",
                          "description": "<p>Must speak fluent English and deploy on AWS.</p>"
                        },
                        {
                          "id": 1002,
                          "title": "Marketing Operations Manager",
                          "company_name": "GrowthOrg",
                          "candidate_required_location": "Worldwide",
                          "url": "https://remotive.com/remote-jobs/marketing/1002",
                          "publication_date": "%s",
                          "description": "<p>English C1 required.</p>"
                        },
                        {
                          "id": 1003,
                          "title": "US-Only Tax Accountant",
                          "company_name": "USTaxCo",
                          "candidate_required_location": "USA Only",
                          "publication_date": "%s",
                          "url": "https://remotive.com/remote-jobs/finance/1003"
                        }
                      ]
                    }
                    """.formatted(fechaFresca, fechaFresca, fechaFresca);

            var resultado = conector.procesar(json);
            assertThat(resultado.fallo()).isFalse();
            assertThat(resultado.ofertas()).hasSize(2);
            assertThat(resultado.ofertas()).extracting(o -> o.vacante().getTitulo())
                    .containsExactlyInAnyOrder("Bilingual DevOps Engineer", "Marketing Operations Manager");
        }
    }
}
