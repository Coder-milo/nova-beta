package com.novacrm.scraper;

import com.novacrm.scraper.fuente.OfertaCruda;
import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Milestone 1 Empirical Challenger: Pipeline Gatekeeper Adversarial Test Suite")
public class M1ScraperAdversarialStressTest {

    private final LocalDateTime ahora = LocalDateTime.now();

    @Test
    @DisplayName("ScrapingService soloFrescas strictly filters out any non-fresh vacancy before DB saving")
    void testSoloFrescasGatekeeper() throws Exception {
        var vFresca = new Vacante();
        vFresca.setTitulo("Fresca 2d");
        vFresca.setFechaPublicacion(ahora.minusDays(2));

        var vLimite = new Vacante();
        vLimite.setTitulo("Fresca 7d Exacto");
        vLimite.setFechaPublicacion(ahora.minusDays(7));

        var vVieja = new Vacante();
        vVieja.setTitulo("Stale 8d");
        vVieja.setFechaPublicacion(ahora.minusDays(8));

        var vNula = new Vacante();
        vNula.setTitulo("Sin Fecha");
        vNula.setFechaPublicacion(null);

        var lista = List.of(
                new OfertaCruda(vFresca, "Empresa 1"),
                new OfertaCruda(vLimite, "Empresa 2"),
                new OfertaCruda(vVieja, "Empresa 3"),
                new OfertaCruda(vNula, "Empresa 4")
        );

        Method soloFrescasMethod = ScrapingService.class.getDeclaredMethod("soloFrescas", List.class, LocalDateTime.class);
        soloFrescasMethod.setAccessible(true);

        @SuppressWarnings("unchecked")
        List<OfertaCruda> filtradas = (List<OfertaCruda>) soloFrescasMethod.invoke(null, lista, ahora);

        assertThat(filtradas).hasSize(2);
        assertThat(filtradas).extracting(o -> o.vacante().getTitulo())
                .containsExactlyInAnyOrder("Fresca 2d", "Fresca 7d Exacto");
    }
}
