package com.novacrm.scraper.portal;

import com.novacrm.scraper.fuente.Segmento;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class LinkedInJobsScraperTest {

    private LinkedInJobsScraper scraper;

    @BeforeEach
    void setUp() {
        scraper = new LinkedInJobsScraper(true);
    }

    @Test
    void verificaMetadatosDelConector() {
        assertEquals("LINKEDIN", scraper.nombre());
        assertEquals(Segmento.LOCAL_COLOMBIA, scraper.segmento());
        assertTrue(scraper.filtraPorCiudad());
        assertTrue(scraper.estaHabilitada());
        assertEquals(8, scraper.maximoConsultasPorCorrida());
    }

    @Test
    void deshabilitadoDevuelveResultadoVacio() {
        LinkedInJobsScraper desactivado = new LinkedInJobsScraper(false);
        assertFalse(desactivado.estaHabilitada());
        var res = desactivado.buscar("bilingual customer service", "Barranquilla");
        assertTrue(res.ofertas().isEmpty());
        assertFalse(res.fallo());
    }

    @Test
    void parseaTarjetasRealesDeLinkedIn() {
        String fechaFresca = java.time.LocalDate.now().minusDays(1).toString();
        String html = """
                <ul>
                    <li>
                        <div class="base-card relative w-full hover:no-underline focus:no-underline base-card--link base-search-card base-search-card--link job-search-card">
                            <a class="base-card__full-link absolute top-0 right-0 bottom-0 left-0 p-0 z-[2]" href="https://co.linkedin.com/jobs/view/bilingual-customer-support-specialist-at-resolv-global-4418504608?position=1&amp;pageNum=0">
                                <span class="sr-only">Bilingual Customer Support &amp; Lead Generation Specialist</span>
                            </a>
                            <div class="base-search-card__info">
                                <h3 class="base-search-card__title">
                                    Bilingual Customer Support &amp; Lead Generation Specialist
                                </h3>
                                <h4 class="base-search-card__subtitle">
                                    <a class="hidden-nested-link" href="https://co.linkedin.com/company/resolv-global">
                                        Resolv Global
                                    </a>
                                </h4>
                                <div class="base-search-card__metadata">
                                    <span class="job-search-card__location">
                                        Barranquilla, Atlántico, Colombia
                                    </span>
                                    <time class="job-search-card__listdate" datetime="%s">Hace 1 día</time>
                                </div>
                            </div>
                        </div>
                    </li>
                    <li>
                        <div class="base-card relative w-full hover:no-underline focus:no-underline base-card--link base-search-card base-search-card--link job-search-card">
                            <a class="base-card__full-link absolute top-0 right-0 bottom-0 left-0 p-0 z-[2]" href="https://co.linkedin.com/jobs/view/it-support-agent-at-auxis-4420000000?position=2&amp;pageNum=0">
                                <span class="sr-only">IT Support Agent Bilingual</span>
                            </a>
                            <div class="base-search-card__info">
                                <h3 class="base-search-card__title">
                                    IT Support Agent Bilingual
                                </h3>
                                <h4 class="base-search-card__subtitle">
                                    Auxis
                                </h4>
                                <div class="base-search-card__metadata">
                                    <span class="job-search-card__location">
                                        Soledad, Atlántico, Colombia
                                    </span>
                                    <time class="job-search-card__listdate">Hace 2 días</time>
                                </div>
                            </div>
                        </div>
                    </li>
                </ul>
                """.formatted(fechaFresca);

        Document doc = Jsoup.parse(html);
        var ofertas = LinkedInJobsScraper.parsear(doc, "Barranquilla");

        assertEquals(2, ofertas.size());

        var o1 = ofertas.get(0);
        assertEquals("Bilingual Customer Support & Lead Generation Specialist", o1.vacante().getTitulo());
        assertEquals("Resolv Global", o1.nombreEmpresa());
        assertEquals("Barranquilla", o1.vacante().getCiudad());
        assertEquals("LINKEDIN", o1.vacante().getFuente());
        assertTrue(o1.vacante().getUrlOrigen().contains("4418504608"));
        assertNotNull(o1.vacante().getFechaPublicacion());
        assertTrue(com.novacrm.scraper.fuente.FiltroFrescura.esFresca(o1.vacante().getFechaPublicacion()));

        var o2 = ofertas.get(1);
        assertEquals("IT Support Agent Bilingual", o2.vacante().getTitulo());
        assertEquals("Auxis", o2.nombreEmpresa());
        assertEquals("Soledad", o2.vacante().getCiudad());
        assertNotNull(o2.vacante().getFechaPublicacion());
        assertTrue(com.novacrm.scraper.fuente.FiltroFrescura.esFresca(o2.vacante().getFechaPublicacion()));
    }

    @Test
    void descartaOfertasDeOtrasRegionesQueNoSonRemotas() {
        String html = """
                <ul>
                    <li>
                        <div class="base-card">
                            <a class="base-card__full-link" href="https://co.linkedin.com/jobs/view/medellin-job-123456789">
                                <span class="sr-only">Asesor Presencial Medellín</span>
                            </a>
                            <div class="base-search-card__info">
                                <h3 class="base-search-card__title">Asesor Presencial Medellín</h3>
                                <h4 class="base-search-card__subtitle">Empresa Medellín</h4>
                                <div class="base-search-card__metadata">
                                    <span class="job-search-card__location">Medellín, Antioquia, Colombia</span>
                                    <time class="job-search-card__listdate">Hace 1 día</time>
                                </div>
                            </div>
                        </div>
                    </li>
                </ul>
                """;

        Document doc = Jsoup.parse(html);
        var ofertas = LinkedInJobsScraper.parsear(doc, "Barranquilla");

        // Debe descartarse por estar en Medellín y no ser remota
        assertTrue(ofertas.isEmpty());
    }

    @Test
    void descartaOfertasConFechasAntiguasOSinFecha() {
        String html = """
                <ul>
                    <li>
                        <div class="base-card">
                            <a class="base-card__full-link" href="https://co.linkedin.com/jobs/view/stale-job-11111111">
                                <span class="sr-only">Old Job</span>
                            </a>
                            <div class="base-search-card__info">
                                <h3 class="base-search-card__title">Old Job</h3>
                                <div class="base-search-card__metadata">
                                    <span class="job-search-card__location">Barranquilla, Atlántico, Colombia</span>
                                    <time class="job-search-card__listdate" datetime="2026-01-01">Hace 2 meses</time>
                                </div>
                            </div>
                        </div>
                    </li>
                    <li>
                        <div class="base-card">
                            <a class="base-card__full-link" href="https://co.linkedin.com/jobs/view/no-date-job-22222222">
                                <span class="sr-only">No Date Job</span>
                            </a>
                            <div class="base-search-card__info">
                                <h3 class="base-search-card__title">No Date Job</h3>
                                <div class="base-search-card__metadata">
                                    <span class="job-search-card__location">Barranquilla, Atlántico, Colombia</span>
                                </div>
                            </div>
                        </div>
                    </li>
                </ul>
                """;

        Document doc = Jsoup.parse(html);
        var ofertas = LinkedInJobsScraper.parsear(doc, "Barranquilla");
        assertTrue(ofertas.isEmpty(), "las ofertas con más de 7 días o sin fecha deben descartarse");
    }
}
