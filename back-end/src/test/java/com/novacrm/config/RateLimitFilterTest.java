package com.novacrm.config;

import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Comportamiento del limite por IP.
 *
 * <p>Cubre los dos fallos que tenia: que la cabecera X-Forwarded-For permitiera
 * estrenar contador a voluntad, y que todo el trafico venido del SSR del
 * frontend cayera en un unico contador compartido.
 */
class RateLimitFilterTest {

    private static final String PROXY = "127.0.0.1/32";

    /** Limite de 2 peticiones por minuto para que las pruebas sean rapidas. */
    private RateLimitFilter filtro(String proxiesDeConfianza) {
        return new RateLimitFilter(2, 1, 2, 1, proxiesDeConfianza);
    }

    private int pedirLogin(RateLimitFilter filtro, String remoteAddr, String forwardedFor)
            throws Exception {
        var request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRequestURI("/api/v1/auth/login");
        request.setRemoteAddr(remoteAddr);
        if (forwardedFor != null) {
            request.addHeader("X-Forwarded-For", forwardedFor);
        }
        var response = new MockHttpServletResponse();
        filtro.doFilter(request, response, new MockFilterChain());
        return response.getStatus();
    }

    @Test
    void cortaTrasSuperarElLimiteDeLogin() throws Exception {
        var filtro = filtro(PROXY);

        assertEquals(HttpServletResponse.SC_OK, pedirLogin(filtro, "203.0.113.1", null));
        assertEquals(HttpServletResponse.SC_OK, pedirLogin(filtro, "203.0.113.1", null));
        assertEquals(429, pedirLogin(filtro, "203.0.113.1", null),
                "la tercera peticion en la ventana debe rechazarse");
    }

    /**
     * Antes bastaba con cambiar la cabecera en cada intento para reiniciar el
     * contador y dejar el anti fuerza bruta en nada.
     */
    @Test
    void noSePuedeEsquivarElLimiteFalseandoLaCabecera() throws Exception {
        var filtro = filtro(PROXY);

        pedirLogin(filtro, "203.0.113.1", "1.1.1.1");
        pedirLogin(filtro, "203.0.113.1", "2.2.2.2");

        assertEquals(429, pedirLogin(filtro, "203.0.113.1", "3.3.3.3"),
                "el cliente directo no es un proxy de confianza: su cabecera se ignora");
    }

    /**
     * Con el frontend haciendo de proxy, el backend ve siempre la misma IP. Si
     * no se distingue al usuario real, dos usuarios agotan el cupo de todos.
     */
    @Test
    void usuariosDistintosDetrasDelProxyNoCompartenContador() throws Exception {
        var filtro = filtro(PROXY);

        assertEquals(HttpServletResponse.SC_OK, pedirLogin(filtro, "127.0.0.1", "203.0.113.1"));
        assertEquals(HttpServletResponse.SC_OK, pedirLogin(filtro, "127.0.0.1", "203.0.113.1"));
        assertEquals(429, pedirLogin(filtro, "127.0.0.1", "203.0.113.1"));

        assertEquals(HttpServletResponse.SC_OK, pedirLogin(filtro, "127.0.0.1", "203.0.113.2"),
                "otro usuario detras del mismo proxy debe tener su propio cupo");
    }

    @Test
    void laRespuestaDeRechazoIndicaCuandoReintentar() throws Exception {
        var filtro = filtro(PROXY);
        pedirLogin(filtro, "203.0.113.1", null);
        pedirLogin(filtro, "203.0.113.1", null);

        var request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRequestURI("/api/v1/auth/login");
        request.setRemoteAddr("203.0.113.1");
        var response = new MockHttpServletResponse();
        filtro.doFilter(request, response, new MockFilterChain());

        assertEquals(429, response.getStatus());
        assertEquals("60", response.getHeader("Retry-After"));
        assertTrue(response.getContentAsString().contains("Demasiadas peticiones"));
    }

    @Test
    void elLoginYElRestoDeLaApiTienenCuposSeparados() throws Exception {
        var filtro = filtro(PROXY);

        pedirLogin(filtro, "203.0.113.1", null);
        pedirLogin(filtro, "203.0.113.1", null);
        assertEquals(429, pedirLogin(filtro, "203.0.113.1", null));

        var request = new MockHttpServletRequest("GET", "/api/v1/estudiantes");
        request.setRequestURI("/api/v1/estudiantes");
        request.setRemoteAddr("203.0.113.1");
        var response = new MockHttpServletResponse();
        filtro.doFilter(request, response, new MockFilterChain());

        assertEquals(HttpServletResponse.SC_OK, response.getStatus(),
                "agotar el cupo de login no debe bloquear el resto de la API");
    }

    private int pedir(RateLimitFilter filtro, String uri, String remoteAddr) throws Exception {
        var request = new MockHttpServletRequest("POST", uri);
        request.setRequestURI(uri);
        request.setRemoteAddr(remoteAddr);
        var response = new MockHttpServletResponse();
        filtro.doFilter(request, response, new MockFilterChain());
        return response.getStatus();
    }

    /**
     * Renovar la sesion no es adivinar una contrasena.
     *
     * <p>El limite estricto se aplicaba a todo {@code /api/v1/auth}, refresh
     * incluido. Una pantalla que dispara varias llamadas a la vez con el token
     * recien vencido gastaba varios refrescos de golpe, agotaba el cupo y
     * recibia un 429; el frontend interpretaba ese 429 como sesion muerta,
     * cerraba la sesion, y el intento de volver a entrar chocaba con el mismo
     * contador agotado. Ese era el bucle.
     */
    @Test
    void elRefreshNoGastaElCupoDeFuerzaBruta() throws Exception {
        var filtro = filtro(PROXY);

        assertEquals(HttpServletResponse.SC_OK, pedir(filtro, "/api/v1/auth/refresh", "203.0.113.1"));
        assertEquals(HttpServletResponse.SC_OK, pedir(filtro, "/api/v1/auth/refresh", "203.0.113.1"));
        assertEquals(HttpServletResponse.SC_OK, pedirLogin(filtro, "203.0.113.1", null),
                "dos refrescos no pueden dejar al usuario sin poder iniciar sesion");
    }

    @Test
    void elLoginSigueTeniendoElLimiteEstricto() throws Exception {
        var filtro = filtro(PROXY);

        pedirLogin(filtro, "203.0.113.1", null);
        pedirLogin(filtro, "203.0.113.1", null);
        assertEquals(429, pedirLogin(filtro, "203.0.113.1", null));
    }

    /** Recuperar contrasena tambien acepta una credencial: limite estricto. */
    @Test
    void recuperarContrasenaTieneElLimiteEstricto() throws Exception {
        var filtro = filtro(PROXY);

        pedir(filtro, "/api/v1/auth/forgot-password", "203.0.113.1");
        pedir(filtro, "/api/v1/auth/forgot-password", "203.0.113.1");
        assertEquals(429, pedir(filtro, "/api/v1/auth/reset-password", "203.0.113.1"),
                "comparten el cupo estricto: las dos sirven para adivinar");
    }

    @Test
    void lasRutasFueraDeLaApiNoConsumenCupo() throws Exception {
        var filtro = filtro(PROXY);

        for (int i = 0; i < 5; i++) {
            var request = new MockHttpServletRequest("GET", "/actuator/health");
            request.setRequestURI("/actuator/health");
            request.setRemoteAddr("203.0.113.1");
            var response = new MockHttpServletResponse();
            filtro.doFilter(request, response, new MockFilterChain());
            assertEquals(HttpServletResponse.SC_OK, response.getStatus());
        }
        assertEquals(0, filtro.contadoresVivos(),
                "una ruta fuera de /api no deberia crear contadores");
    }

    /**
     * Cada IP distinta creaba una entrada que no se borraba nunca. Con la
     * cabecera falseable, eso permitia hacer crecer la memoria sin limite.
     */
    @Test
    void noAcumulaUnContadorPorCadaIpVistaSinLimite() throws Exception {
        var filtro = filtro(PROXY);

        for (int i = 0; i < 3_000; i++) {
            pedirLogin(filtro, "10.10." + (i / 256) + "." + (i % 256), null);
        }

        assertTrue(filtro.contadoresVivos() <= 3_000,
                "los contadores no deben crecer mas alla de las IPs vistas");
        assertTrue(filtro.contadoresVivos() > 0, "deben seguir existiendo contadores activos");
    }
}
