package com.novacrm.scraper;

import com.novacrm.scraper.fuente.FuenteDeVacantes;
import com.novacrm.scraper.fuente.ResultadoBusqueda;
import com.novacrm.scraper.fuente.Segmento;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * En qué hilos corre la fase de red.
 *
 * <p>Se consultaba con {@code activas.parallelStream()}, que usa el
 * {@code ForkJoinPool.commonPool()} de la JVM. Ese pool es de toda la
 * aplicación y está dimensionado para trabajo de CPU —núcleos menos uno—,
 * mientras que aquí cada consulta se pasa hasta quince segundos parada
 * esperando a un portal. En una máquina de dos núcleos el pool común tiene
 * <strong>un</strong> hilo: cuatro portales lentos lo dejaban sin nada libre.
 *
 * <p>Lo que se rompía no era el scraping —ese acababa— sino cualquier otra
 * parte de la aplicación que usara un stream paralelo mientras tanto, que se
 * quedaba en cola detrás de una petición a Computrabajo. Es la clase de fallo
 * que no aparece en el módulo que lo causa.
 */
class PoolPropioDelScrapingTest {

    /** Fuente que solo apunta en qué hilo la llamaron y cuánto tardó. */
    private static class FuenteQueApunta implements FuenteDeVacantes {

        private final String nombre;
        private final long tardanzaMs;
        final Set<String> hilos = ConcurrentHashMap.newKeySet();

        FuenteQueApunta(String nombre, long tardanzaMs) {
            this.nombre = nombre;
            this.tardanzaMs = tardanzaMs;
        }

        @Override public String nombre() { return nombre; }
        @Override public Segmento segmento() { return Segmento.LOCAL_COLOMBIA; }
        @Override public int maximoConsultasPorCorrida() { return 1; }

        @Override
        public ResultadoBusqueda buscar(String termino, String ciudad) {
            hilos.add(Thread.currentThread().getName());
            try {
                Thread.sleep(tardanzaMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return ResultadoBusqueda.de(List.of());
        }
    }

    private static ScrapingService servicio() {
        return new ScrapingService(List.of(),
                mock(com.novacrm.estudiante.EstudianteRepository.class),
                mock(com.novacrm.vacante.VacanteRepository.class),
                mock(ScrapingEjecucionRepository.class),
                mock(com.novacrm.vacante.RegistroDeVacante.class));
    }

    private static ScrapingService.Criterios unTermino() {
        return new ScrapingService.Criterios(List.of("servicio al cliente"), List.of("Barranquilla"));
    }

    @Test
    @DisplayName("las fuentes no corren en el ForkJoinPool común de la aplicación")
    void noSeUsaElPoolComun() {
        var fuente = new FuenteQueApunta("UNA", 10);

        servicio().consultarFuentes(List.of(fuente), unTermino(), new ArrayList<>());

        assertThat(fuente.hilos).hasSize(1);
        String hilo = fuente.hilos.iterator().next();
        assertThat(hilo)
                .as("la E/S bloqueante no puede correr en el pool que comparte toda la aplicación")
                .doesNotContain("ForkJoinPool.commonPool")
                .startsWith("scraping-");
    }

    @Test
    @DisplayName("las fuentes se consultan a la vez, no una detrás de otra")
    void sonSimultaneas() {
        // Cuatro fuentes de 250 ms. En serie serían 1000 ms; en paralelo, ~250.
        // El margen es ancho a propósito: lo que se comprueba es que no se
        // encadenan, no cuánto tarda la máquina de quien ejecuta la prueba.
        var fuentes = List.of(
                new FuenteQueApunta("A", 250), new FuenteQueApunta("B", 250),
                new FuenteQueApunta("C", 250), new FuenteQueApunta("D", 250));

        long inicio = System.nanoTime();
        servicio().consultarFuentes(List.copyOf(fuentes), unTermino(), new ArrayList<>());
        long milis = (System.nanoTime() - inicio) / 1_000_000;

        assertThat(milis).isLessThan(700);
        assertThat(fuentes.stream().flatMap(f -> f.hilos.stream()).distinct().count())
                .as("cada fuente en su hilo")
                .isEqualTo(4);
    }

    @Test
    @DisplayName("una fuente que revienta no se lleva a las demás")
    void unaQueFallaNoTumbaLaCorrida() {
        var buena = new FuenteQueApunta("BUENA", 5);
        FuenteDeVacantes mala = new FuenteQueApunta("MALA", 0) {
            @Override
            public ResultadoBusqueda buscar(String termino, String ciudad) {
                throw new IllegalStateException("el portal cambio de sitio");
            }
        };
        var errores = new ArrayList<String>();

        servicio().consultarFuentes(List.of(mala, buena), unTermino(), errores);

        assertThat(buena.hilos).hasSize(1);
        assertThat(errores).anyMatch(e -> e.contains("el portal cambio de sitio"));
    }

    @Test
    @DisplayName("el desglose por portal se lee de vuelta tal como se guardó")
    void elConteoPorPortalSeGuardaYSeLee() {
        var leido = ScrapingService.conteoPorPortal("REMOTIVE=12;ELEMPLEO=0;JSEARCH=4");

        assertThat(leido).extracting("portal", "ofertas")
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("REMOTIVE", 12),
                        org.assertj.core.groups.Tuple.tuple("ELEMPLEO", 0),
                        org.assertj.core.groups.Tuple.tuple("JSEARCH", 4));
    }

    @Test
    @DisplayName("sin desglose la lista va vacía: «no se registró» no es «cero»")
    void sinDesgloseNoSeInventaNada() {
        // Las corridas anteriores a la columna traen null. Devolver ceros aqui
        // haria que el panel marcara como rotos portales que iban bien.
        assertThat(ScrapingService.conteoPorPortal(null)).isEmpty();
        assertThat(ScrapingService.conteoPorPortal("")).isEmpty();
    }

    @Test
    @DisplayName("un par ilegible se salta, no tumba la corrida entera")
    void unParRotoNoEsconderElResto() {
        // El historial existe para diagnosticar. Romperlo por una fila mal
        // escrita deja sin ver tambien las corridas buenas, que es lo contrario
        // de para lo que esta.
        var leido = ScrapingService.conteoPorPortal("REMOTIVE=12;BASURA;ELEMPLEO=x;JSEARCH=4");

        assertThat(leido).extracting("portal").containsExactly("REMOTIVE", "JSEARCH");
    }

    @Test
    @DisplayName("cero ofertas sin ningún error se avisa igual")
    void elSilencioTambienSeAvisa() {
        // Un portal cuyos selectores se caen responde 200 y devuelve cero: no
        // falla, deja de servir. Sin este aviso el sintoma es indistinguible de
        // una semana floja, que es como murio Elempleo sin que nadie lo viera.
        var errores = new ArrayList<String>();

        servicio().consultarFuentes(List.of(new FuenteQueApunta("MUDA", 0)), unTermino(), errores);

        assertThat(errores).anyMatch(e -> e.contains("cero ofertas"));
    }
}
