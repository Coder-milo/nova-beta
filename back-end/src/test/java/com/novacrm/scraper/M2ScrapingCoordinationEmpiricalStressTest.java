package com.novacrm.scraper;

import com.novacrm.scraper.fuente.FuenteDeVacantes;
import com.novacrm.scraper.fuente.ResultadoBusqueda;
import com.novacrm.scraper.fuente.Segmento;
import com.novacrm.scraper.fuente.ArbeitnowConnector;
import com.novacrm.scraper.fuente.JSearchConnector;
import com.novacrm.scraper.fuente.SmartRecruitersConnector;
import com.novacrm.scraper.portal.ComputrabajoScraper;
import com.novacrm.scraper.portal.ElempleoScraper;
import com.novacrm.scraper.portal.LinkedInJobsScraper;
import com.novacrm.scraper.portal.RemotiveConnector;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

@DisplayName("M2 Empirical Challenger: Scraping Coordination & Rate Caps")
public class M2ScrapingCoordinationEmpiricalStressTest {

    private final ScrapingService servicio = new ScrapingService(
            List.of(), null, null, null, null);

    private static final List<String> MULTI_CAREER_TERMS = List.of(
            "desarrollador backend bilingue",
            "software engineer bilingual",
            "ingeniero industrial bilingue",
            "contador bilingue",
            "analista datos bilingue",
            "disenador ui ux bilingue",
            "marketing bilingue",
            "medico bilingue",
            "bilingual customer service",
            "soporte tecnico bilingue"
    );

    private static final List<String> COHORTE_CITIES = List.of(
            "Barranquilla", "Soledad", "Malambo", "Galapa", "Puerto Colombia"
    );

    @Test
    @DisplayName("Verify all 7 connectors declare correct metadata and segments")
    void testAll7ConnectorsMetadata() {
        var computrabajo = new ComputrabajoScraper(true);
        var elempleo = new ElempleoScraper(true);
        var linkedin = new LinkedInJobsScraper(true);
        var remotive = new RemotiveConnector(true);
        var arbeitnow = new ArbeitnowConnector(true, true);
        var smartrecruiters = new SmartRecruitersConnector(true, "Sutherland");
        var jsearch = new JSearchConnector(mock(com.novacrm.scraper.fuente.ControlDeCuota.class), "k", true, 200, 6, "co");

        assertThat(computrabajo.nombre()).isEqualTo("COMPUTRABAJO");
        assertThat(computrabajo.segmento()).isEqualTo(Segmento.LOCAL_COLOMBIA);
        assertThat(computrabajo.filtraPorCiudad()).isTrue();

        assertThat(elempleo.nombre()).isEqualTo("ELEMPLEO");
        assertThat(elempleo.segmento()).isEqualTo(Segmento.LOCAL_COLOMBIA);
        assertThat(elempleo.filtraPorCiudad()).isFalse();

        assertThat(linkedin.nombre()).isEqualTo("LINKEDIN");
        assertThat(linkedin.segmento()).isEqualTo(Segmento.LOCAL_COLOMBIA);
        assertThat(linkedin.filtraPorCiudad()).isTrue();
        assertThat(linkedin.maximoConsultasPorCorrida()).isEqualTo(8);

        assertThat(remotive.nombre()).isEqualTo("REMOTIVE");
        assertThat(remotive.segmento()).isEqualTo(Segmento.REMOTO_INGLES);
        assertThat(remotive.filtraPorCiudad()).isFalse();
        assertThat(remotive.maximoConsultasPorCorrida()).isEqualTo(4);

        assertThat(arbeitnow.nombre()).isEqualTo("ARBEITNOW");
        assertThat(arbeitnow.segmento()).isEqualTo(Segmento.MIGRACION);
        assertThat(arbeitnow.filtraPorCiudad()).isFalse();
        assertThat(arbeitnow.maximoConsultasPorCorrida()).isEqualTo(1);

        assertThat(smartrecruiters.nombre()).isEqualTo("SMARTRECRUITERS");
        assertThat(smartrecruiters.segmento()).isEqualTo(Segmento.LOCAL_COLOMBIA);
        assertThat(smartrecruiters.filtraPorCiudad()).isFalse();
        assertThat(smartrecruiters.maximoConsultasPorCorrida()).isEqualTo(1);

        assertThat(jsearch.nombre()).isEqualTo("JSEARCH");
        assertThat(jsearch.segmento()).isEqualTo(Segmento.LOCAL_COLOMBIA);
        assertThat(jsearch.filtraPorCiudad()).isTrue();
        assertThat(jsearch.maximoConsultasPorCorrida()).isEqualTo(6);
    }

    @ParameterizedTest(name = "Rate limit cap enforcement for source: {0}")
    @MethodSource("connectorCapExpectations")
    void testRateLimitCapEnforcementPerSource(FuenteDeVacantes fuente, int expectedMaxQueries, boolean expectsCity) {
        var criterios = new ScrapingService.Criterios(MULTI_CAREER_TERMS, COHORTE_CITIES);
        var consultas = servicio.consultasPara(fuente, criterios);

        assertThat(consultas.size()).isLessThanOrEqualTo(expectedMaxQueries);
        if (expectsCity) {
            assertThat(consultas.stream().allMatch(c -> c.ciudad() != null)).isTrue();
        } else {
            assertThat(consultas.stream().allMatch(c -> c.ciudad() == null)).isTrue();
        }
    }

    static Stream<Arguments> connectorCapExpectations() {
        return Stream.of(
                Arguments.of(new LinkedInJobsScraper(true), 8, true),
                Arguments.of(new RemotiveConnector(true), 4, false),
                Arguments.of(new ArbeitnowConnector(true, true), 1, false),
                Arguments.of(new SmartRecruitersConnector(true, "Sutherland"), 1, false),
                Arguments.of(new JSearchConnector(mock(com.novacrm.scraper.fuente.ControlDeCuota.class), "k", true, 200, 6, "co"), 6, true),
                Arguments.of(new ComputrabajoScraper(true), 50, true), // 10 terms * 5 cities = 50
                Arguments.of(new ElempleoScraper(true), 10, false)     // 10 terms * 1 (no city) = 10
        );
    }

    @Test
    @DisplayName("Empty search criteria generates zero queries across all sources")
    void testEmptyCriteriaGeneratesZeroQueries() {
        var emptyCriterios = new ScrapingService.Criterios(List.of(), COHORTE_CITIES);
        var fuentes = List.of(
                new ComputrabajoScraper(true),
                new ElempleoScraper(true),
                new LinkedInJobsScraper(true),
                new RemotiveConnector(true),
                new ArbeitnowConnector(true, true),
                new SmartRecruitersConnector(true, "Sutherland"),
                new JSearchConnector(mock(com.novacrm.scraper.fuente.ControlDeCuota.class), "k", true, 200, 6, "co")
        );

        for (var fuente : fuentes) {
            assertThat(servicio.consultasPara(fuente, emptyCriterios)).isEmpty();
        }
    }

    @Test
    @DisplayName("Duplicate terms in criteria are deduplicated before query dispatch")
    void testDuplicateTermsAreDeduplicated() {
        var duplicateCriterios = new ScrapingService.Criterios(
                List.of("bilingue", "bilingue", "contador bilingue", "contador bilingue"),
                List.of("Barranquilla")
        );

        var fuente = new ComputrabajoScraper(true);
        var consultas = servicio.consultasPara(fuente, duplicateCriterios);

        assertThat(consultas).hasSize(2);
    }
}
