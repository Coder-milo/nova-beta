package com.novacrm.scraper.fuente;

import org.jsoup.Connection;
import org.jsoup.HttpStatusException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InterruptedIOException;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.*;

/**
 * Qué se reintenta y cuánto se espera.
 *
 * <p>Antes no se reintentaba nada: un 429 de Computrabajo daba la consulta por
 * perdida. Como las fuentes se consultan a la vez, el propio scraper era quien
 * provocaba ese 429, así que se perdían consultas por lo único que sí tiene
 * arreglo en caliente —esperar unos segundos—.
 */
class ReintentoConEsperaTest {

    /** Respuesta de Jsoup falsa, con su código y sus cabeceras. */
    private static Connection.Response respuesta(int codigo, String reintentarTras) throws IOException {
        var r = mock(Connection.Response.class);
        when(r.statusCode()).thenReturn(codigo);
        when(r.header("Retry-After")).thenReturn(reintentarTras);
        when(r.url()).thenReturn(new URL("https://portal.example/ofertas"));
        when(r.parse()).thenReturn(org.jsoup.Jsoup.parse("<html><body>ok</body></html>"));
        return r;
    }

    /**
     * Conexión que devuelve las respuestas dadas, una por intento.
     *
     * <p>Se cuenta cuántas veces se pidió una conexión nueva: es lo que dice si
     * de verdad hubo reintentos, sin depender de los tiempos.
     */
    private static java.util.function.Supplier<Connection> conexionQueDevuelve(
            AtomicInteger intentos, Connection.Response... porIntento) {
        return () -> {
            int i = intentos.getAndIncrement();
            var conexion = mock(Connection.class);
            when(conexion.ignoreHttpErrors(anyBoolean())).thenReturn(conexion);
            try {
                when(conexion.execute()).thenReturn(porIntento[Math.min(i, porIntento.length - 1)]);
            } catch (IOException e) {
                throw new IllegalStateException(e);
            }
            return conexion;
        };
    }

    @Test
    @DisplayName("un 429 se reintenta y la segunda vez entra")
    void elLimiteDeRitmoSeEspera() throws Exception {
        var intentos = new AtomicInteger();
        var conexion = conexionQueDevuelve(intentos, respuesta(429, null), respuesta(200, null));

        var doc = ReintentoConEspera.documento("PORTAL", conexion);

        assertThat(doc.text()).isEqualTo("ok");
        assertThat(intentos.get()).as("hubo un segundo intento").isEqualTo(2);
    }

    @Test
    @DisplayName("el 403 del cortafuegos también se reintenta")
    void elCortafuegosSeEspera() throws Exception {
        var intentos = new AtomicInteger();
        var conexion = conexionQueDevuelve(intentos, respuesta(403, null), respuesta(200, null));

        assertThat(ReintentoConEspera.documento("PORTAL", conexion).text()).isEqualTo("ok");
        assertThat(intentos.get()).isEqualTo(2);
    }

    @Test
    @DisplayName("un 404 no se reintenta: la página no va a aparecer")
    void loQueNoExisteNoSeInsiste() throws Exception {
        var intentos = new AtomicInteger();
        var conexion = conexionQueDevuelve(intentos, respuesta(404, null));

        assertThatThrownBy(() -> ReintentoConEspera.documento("PORTAL", conexion))
                .isInstanceOf(HttpStatusException.class)
                // Los scrapers distinguen «pagina 2 que ya no existe» de «portal
                // caido» por este tipo. Cambiarlo rompe ese corte del bucle.
                .extracting(e -> ((HttpStatusException) e).getStatusCode())
                .isEqualTo(404);
        assertThat(intentos.get()).as("un solo intento").isEqualTo(1);
    }

    @Test
    @DisplayName("tras agotar los intentos se falla, no se insiste para siempre")
    void seRindeConLimite() throws Exception {
        var intentos = new AtomicInteger();
        var conexion = conexionQueDevuelve(intentos, respuesta(503, null));

        assertThatThrownBy(() -> ReintentoConEspera.documento("PORTAL", conexion))
                .isInstanceOf(HttpStatusException.class);
        assertThat(intentos.get()).isEqualTo(ReintentoConEspera.INTENTOS);
    }

    @Test
    @DisplayName("un fallo de red también se reintenta")
    void laRedCortadaSeReintenta() throws Exception {
        var intentos = new AtomicInteger();
        var buena = respuesta(200, null);
        java.util.function.Supplier<Connection> conexion = () -> {
            int i = intentos.getAndIncrement();
            var c = mock(Connection.class);
            when(c.ignoreHttpErrors(anyBoolean())).thenReturn(c);
            try {
                if (i == 0) when(c.execute()).thenThrow(new SocketTimeoutException("read timed out"));
                else when(c.execute()).thenReturn(buena);
            } catch (IOException e) {
                throw new IllegalStateException(e);
            }
            return c;
        };

        assertThat(ReintentoConEspera.documento("PORTAL", conexion).text()).isEqualTo("ok");
        assertThat(intentos.get()).isEqualTo(2);
    }

    @Test
    @DisplayName("se respeta Retry-After cuando el portal lo manda")
    void mandaElPortal() {
        // 2 s dichos por el portal ganan a la progresión propia, que en el
        // primer intento daría ~1,5 s. Es la única cifra fiable que hay.
        assertThat(ReintentoConEspera.esperaEnMilis(1, "2")).isEqualTo(2_000);
    }

    @Test
    @DisplayName("un Retry-After absurdo se recorta")
    void nadieDuermeUnaHora() {
        // `Retry-After: 3600` dentro de la corrida diaria la deja colgada.
        assertThat(ReintentoConEspera.esperaEnMilis(1, "3600"))
                .isEqualTo(ReintentoConEspera.ESPERA_MAXIMA_MS);
    }

    @Test
    @DisplayName("sin Retry-After la espera crece y lleva desajuste")
    void progresionConDesajuste() {
        long primera = ReintentoConEspera.esperaEnMilis(1, null);
        long segunda = ReintentoConEspera.esperaEnMilis(2, null);

        assertThat(primera).isBetween(ReintentoConEspera.ESPERA_BASE_MS,
                ReintentoConEspera.ESPERA_BASE_MS + ReintentoConEspera.ESPERA_BASE_MS / 2);
        // El desajuste evita que dos fuentes que reciben el mismo 429 vuelvan a
        // llamar exactamente a la vez, que es como se provoca el siguiente.
        assertThat(segunda).isGreaterThan(primera);
        assertThat(segunda).isLessThanOrEqualTo(ReintentoConEspera.ESPERA_MAXIMA_MS);
    }

    @Test
    @DisplayName("una cabecera con fecha HTTP no rompe: se usa la progresión")
    void laFormaConFechaSeIgnora() {
        assertThat(ReintentoConEspera.esperaEnMilis(1, "Wed, 21 Oct 2026 07:28:00 GMT"))
                .isBetween(ReintentoConEspera.ESPERA_BASE_MS, ReintentoConEspera.ESPERA_MAXIMA_MS);
    }

    @Test
    @DisplayName("interrumpir corta de verdad, no solo marca la bandera")
    void alInterrumpirSeAborta() throws Exception {
        var intentos = new AtomicInteger();
        var conexion = conexionQueDevuelve(intentos, respuesta(503, null));

        Thread.currentThread().interrupt();
        try {
            assertThatThrownBy(() -> ReintentoConEspera.documento("PORTAL", conexion))
                    .as("sin esto la corrida sigue pidiendo paginas despues de cancelarla")
                    .isInstanceOf(InterruptedIOException.class);
        } finally {
            Thread.interrupted();
        }
    }

    @Test
    void codigosQueMerecenOtroIntento() {
        assertThat(ReintentoConEspera.mereceOtroIntento(429)).isTrue();
        assertThat(ReintentoConEspera.mereceOtroIntento(503)).isTrue();
        assertThat(ReintentoConEspera.mereceOtroIntento(404)).isFalse();
        assertThat(ReintentoConEspera.mereceOtroIntento(200)).isFalse();
    }
}
