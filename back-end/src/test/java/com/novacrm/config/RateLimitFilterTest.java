package com.novacrm.config;

import com.novacrm.auth.JwtClaims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;

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

    /**
     * Llenar la memoria de la API no puede reiniciar el freno del login.
     *
     * <p>El tope se medía sobre la suma de los dos registros y, al desbordarse,
     * se vaciaban los dos. Asi que generar trafico desde muchas direcciones
     * —trivial con un rango IPv6 propio— borraba tambien los intentos fallidos
     * acumulados: quien estaba adivinando una contrasena recuperaba sus cinco
     * intentos por minuto tantas veces como quisiera.
     *
     * <p>Son dos defensas distintas y una no puede apagar a la otra.
     */
    @Test
    void llenarElRegistroDeLaApiNoBorraElFrenoDelLogin() throws Exception {
        var filtro = filtro(PROXY);
        String atacante = "203.0.113.7";

        assertEquals(HttpServletResponse.SC_OK, pedirLogin(filtro, atacante, null));
        assertEquals(HttpServletResponse.SC_OK, pedirLogin(filtro, atacante, null));
        assertEquals(429, pedirLogin(filtro, atacante, null), "el freno esta puesto");

        // Trafico de la API desde muchas direcciones distintas, por encima del
        // presupuesto de ese registro.
        for (int i = 0; i < 26_000; i++) {
            pedirApi(filtro, "10." + (i / 65_536) + "." + ((i / 256) % 256) + "." + (i % 256), null);
        }

        assertEquals(429, pedirLogin(filtro, atacante, null),
                "el contador de login del atacante sigue agotado");
    }

    // --- Cupo por usuario en el resto de la API ---

    private static final String SECRETO = "secreto_de_prueba_para_el_rate_limit_con_32_bytes_o_mas";

    /** Deja {@code jwtSecretActivo} listo para poder firmar tokens de prueba. */
    private static void prepararSecreto() {
        var config = new SecurityConfig();
        ReflectionTestUtils.setField(config, "jwtSecret", SECRETO);
        ReflectionTestUtils.setField(config, "allowEphemeralSecret", false);
        config.validarJwtSecret();
    }

    private static String tokenDe(String sujeto) {
        prepararSecreto();
        return Jwts.builder()
                .subject(sujeto)
                .claim(JwtClaims.TYPE, JwtClaims.TYPE_ACCESS)
                .signWith(Keys.hmacShaKeyFor(SECRETO.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    private int pedirApi(RateLimitFilter filtro, String remoteAddr, String token) throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/v1/estudiantes");
        request.setRequestURI("/api/v1/estudiantes");
        request.setRemoteAddr(remoteAddr);
        if (token != null) {
            request.addHeader("Authorization", "Bearer " + token);
        }
        var response = new MockHttpServletResponse();
        filtro.doFilter(request, response, new MockFilterChain());
        return response.getStatus();
    }

    /**
     * El caso real: el centro de formacion sale a internet por una sola IP, asi
     * que con el contador por IP los estudiantes se robaban el cupo entre ellos
     * y el 429 le tocaba a quien pasara por ahi.
     */
    @Test
    void dosUsuariosEnLaMismaIpNoSeGastanElCupoElUnoAlOtro() throws Exception {
        var filtro = filtro(PROXY);
        String ana = tokenDe("ana@novacrm.test");
        String luis = tokenDe("luis@novacrm.test");

        assertEquals(HttpServletResponse.SC_OK, pedirApi(filtro, "203.0.113.9", ana));
        assertEquals(HttpServletResponse.SC_OK, pedirApi(filtro, "203.0.113.9", ana));
        assertEquals(429, pedirApi(filtro, "203.0.113.9", ana),
                "ana si debe agotar su propio cupo");

        assertEquals(HttpServletResponse.SC_OK, pedirApi(filtro, "203.0.113.9", luis),
                "luis comparte la IP con ana, pero no su cupo");
        assertEquals(HttpServletResponse.SC_OK, pedirApi(filtro, "203.0.113.9", luis));
    }

    /**
     * Si un token inventado estrenara contador, bastaria con cambiar la cabecera
     * en cada peticion para no tener limite ninguno. Sin identificar, se cuenta
     * por IP igual que antes.
     */
    @Test
    void unTokenInventadoNoEstrenaContador() throws Exception {
        var filtro = filtro(PROXY);

        assertEquals(HttpServletResponse.SC_OK, pedirApi(filtro, "203.0.113.10", "basura-1"));
        assertEquals(HttpServletResponse.SC_OK, pedirApi(filtro, "203.0.113.10", "basura-2"));
        assertEquals(429, pedirApi(filtro, "203.0.113.10", "basura-3"),
                "sin firma valida se cuenta por IP: cambiar el token no da cupo nuevo");
    }

    /** Un token bien firmado pero de refresco tampoco identifica: cuenta por IP. */
    @Test
    void elTokenDeRefrescoNoIdentificaParaElCupo() throws Exception {
        var filtro = filtro(PROXY);
        prepararSecreto();
        String refresco = Jwts.builder()
                .subject("ana@novacrm.test")
                .claim(JwtClaims.TYPE, JwtClaims.TYPE_REFRESH)
                .signWith(Keys.hmacShaKeyFor(SECRETO.getBytes(StandardCharsets.UTF_8)))
                .compact();

        assertEquals(HttpServletResponse.SC_OK, pedirApi(filtro, "203.0.113.11", refresco));
        assertEquals(HttpServletResponse.SC_OK, pedirApi(filtro, "203.0.113.11", refresco));
        assertEquals(429, pedirApi(filtro, "203.0.113.11", null),
                "el refresco cae al contador por IP, el mismo que una peticion sin token");
    }

    /** El login sigue contando por IP aunque llegue con un token valido. */
    @Test
    void elLoginSigueContandoPorIpAunqueVengaConToken() throws Exception {
        var filtro = filtro(PROXY);
        String ana = tokenDe("ana@novacrm.test");

        var request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRequestURI("/api/v1/auth/login");
        request.setRemoteAddr("203.0.113.12");
        request.addHeader("Authorization", "Bearer " + ana);
        filtro.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());

        pedirLogin(filtro, "203.0.113.12", null);
        assertEquals(429, pedirLogin(filtro, "203.0.113.12", null),
                "un token valido no puede servir para ampliar el cupo anti fuerza bruta");
    }
}
