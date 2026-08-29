package com.novacrm.desarrollador;

import com.novacrm.configuracion.EstadoIntegracion;
import com.novacrm.configuracion.IntegracionesService;
import com.novacrm.scraper.ScrapingService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthEndpoint;
import org.springframework.core.env.Environment;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/** El diagnóstico técnico debe ser útil sin transportar información sensible. */
@ExtendWith(MockitoExtension.class)
class DiagnosticoDesarrolladorServiceTest {

    @Mock
    private HealthEndpoint healthEndpoint;

    @Mock
    private IntegracionesService integracionesService;

    @Mock
    private ScrapingService scrapingService;

    @Mock
    private Environment environment;

    @Test
    void exponeEstadosPeroNoDetallesNiVariablesDeLasIntegraciones() {
        when(healthEndpoint.health()).thenReturn(Health.up().build());
        when(environment.getActiveProfiles()).thenReturn(new String[] { "production" });
        when(integracionesService.listar()).thenReturn(List.of(new EstadoIntegracion(
                "ia", "Asistencia de IA", "Reconocimiento", true,
                "Servicio disponible.",
                List.of(new EstadoIntegracion.Detalle("Modelo", "modelo-interno")),
                List.of("GROQ_API_KEY"), true, null)));

        var service = new DiagnosticoDesarrolladorService(
                healthEndpoint, integracionesService, scrapingService, environment);
        var resultado = service.resumen();

        assertThat(resultado.estado()).isEqualTo("UP");
        assertThat(resultado.componentes()).singleElement()
                .extracting(DiagnosticoDesarrolladorResponse.Componente::nombre,
                        DiagnosticoDesarrolladorResponse.Componente::estado)
                .containsExactly("aplicación", "UP");
        assertThat(resultado.integraciones()).singleElement().satisfies(integracion -> {
            assertThat(integracion.nombre()).isEqualTo("Asistencia de IA");
            assertThat(integracion.configurada()).isTrue();
        });
        assertThat(DiagnosticoDesarrolladorResponse.Integracion.class.getRecordComponents())
                .extracting(component -> component.getName())
                .doesNotContain("detalles", "variablesEntorno", "credencial", "secreto");
        assertThat(resultado.runtime().perfilActivo()).isEqualTo("production");
    }
}
