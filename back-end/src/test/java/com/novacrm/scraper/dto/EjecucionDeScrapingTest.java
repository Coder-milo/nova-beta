package com.novacrm.scraper.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cómo se lee una corrida desde el panel.
 *
 * <p>Lo que decide este DTO es cuándo una corrida se pinta como problema. Una
 * que trajo ofertas y además falló en un portal no es igual que una que no
 * trajo nada, y pintar las dos con el mismo color es como se deja de mirar el
 * registro.
 */
class EjecucionDeScrapingTest {

    private static EjecucionDeScraping corrida(int nuevas, List<String> errores, LocalDateTime fin) {
        return corrida(nuevas, errores, fin, List.of(
                new EjecucionDeScraping.PortalConOfertas("REMOTIVE", 12),
                new EjecucionDeScraping.PortalConOfertas("JSEARCH", 4)));
    }

    private static EjecucionDeScraping corrida(int nuevas, List<String> errores, LocalDateTime fin,
                                               List<EjecucionDeScraping.PortalConOfertas> porPortal) {
        return new EjecucionDeScraping("id", LocalDateTime.of(2026, 8, 15, 6, 0), fin,
                "PROGRAMADA", List.of("REMOTIVE", "JSEARCH"), nuevas, 3, errores, fin == null, 120L,
                porPortal, 0);
    }

    @Test
    void sinErroresEsCorrecta() {
        assertThat(corrida(12, List.of(), LocalDateTime.now()).estado()).isEqualTo("CORRECTA");
    }

    @Test
    @DisplayName("con errores pero con ofertas nuevas es parcial, no fallida")
    void algoEntroYAlgoFallo() {
        assertThat(corrida(12, List.of("ELEMPLEO: 503"), LocalDateTime.now()).estado())
                .isEqualTo("PARCIAL");
    }

    @Test
    @DisplayName("con errores y sin nada nuevo es fallida")
    void noEntroNada() {
        assertThat(corrida(0, List.of("ELEMPLEO: 503"), LocalDateTime.now()).estado())
                .isEqualTo("FALLIDA");
    }

    @Test
    @DisplayName("una corrida sin fin sigue en curso, aunque no haya traído nada todavía")
    void enCurso() {
        assertThat(corrida(0, List.of(), null).estado()).isEqualTo("EN_CURSO");
    }

    @Test
    @DisplayName("estado viaja en el JSON aunque sea un método derivado")
    void elEstadoLlegaAlPanel() throws Exception {
        // Jackson solo serializa los componentes de un record: un metodo
        // derivado sin @JsonProperty se queda fuera y el panel recibe el campo
        // ausente, sin error ninguno. Esta prueba es el guardian de esa
        // anotacion, que es justo la clase de cosa que alguien quita al limpiar.
        // Con el modulo de fechas, como el ObjectMapper que arma Spring: sin el
        // esto revienta en `inicio` y no llega a comprobar nada de `estado`.
        var mapper = new ObjectMapper()
                .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        String json = mapper.writeValueAsString(
                corrida(0, List.of("ELEMPLEO: 503"), LocalDateTime.now()));

        assertThat(json).contains("\"estado\":\"FALLIDA\"");
        assertThat(json).contains("\"portalesEnCero\":");
    }

    @Test
    @DisplayName("los portales que no trajeron nada se señalan aparte")
    void elPortalMudoSeSeñala() {
        var corrida = corrida(5, List.of(), LocalDateTime.now(), List.of(
                new EjecucionDeScraping.PortalConOfertas("REMOTIVE", 12),
                new EjecucionDeScraping.PortalConOfertas("ELEMPLEO", 0),
                new EjecucionDeScraping.PortalConOfertas("COMPUTRABAJO", 0)));

        assertThat(corrida.portalesEnCero()).containsExactly("ELEMPLEO", "COMPUTRABAJO");
        // Y la corrida sigue siendo CORRECTA: entraron ofertas y nada fallo.
        // El portal mudo es una sospecha, no un fallo; que lo sea o no depende
        // de si se repite, y eso se ve en la serie, no en esta fila.
        assertThat(corrida.estado()).isEqualTo("CORRECTA");
    }

    @Test
    @DisplayName("sin desglose no se inventan ceros")
    void lasCorridasViejasNoSeJuzgan() {
        // Las anteriores a la columna traen la lista vacia. Deducir de ahi que
        // todos los portales trajeron cero seria marcar como rotas un monton de
        // corridas que fueron bien.
        var vieja = corrida(0, List.of(), LocalDateTime.now(), List.of());

        assertThat(vieja.portalesEnCero()).isEmpty();
        assertThat(vieja.estado()).isEqualTo("CORRECTA");
    }
}
