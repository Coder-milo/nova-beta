package com.novacrm.config;

import com.novacrm.auth.JwtClaims;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Rate limiting con bucket4j. Aplica un limite estricto al login (anti fuerza
 * bruta) y otro mas amplio al resto de la API. Los limites se configuran en
 * {@code app.rate-limit.*}.
 *
 * <p>El login cuenta por IP; el resto de la API cuenta por usuario cuando la
 * peticion trae un access token valido, y por IP cuando no. El motivo esta en
 * {@link #identidadApi}.
 *
 * <p>La IP se obtiene con {@link ClientIpResolver}, que solo cree la cabecera
 * {@code X-Forwarded-For} cuando la peticion llega desde un proxy declarado en
 * {@code app.rate-limit.trusted-proxies}. Esto cubre los dos extremos del
 * problema: sin la lista, cualquiera puede estrenar contador falseando la
 * cabecera; sin confiar en el proxy, todo el trafico que pasa por el SSR del
 * frontend comparte un unico contador y la API empieza a devolver 429 a todo el
 * mundo en cuanto hay varios usuarios a la vez.
 *
 * <p>Los contadores viven en memoria y se descartan tras
 * {@link #TTL_INACTIVIDAD}: son suficientes para una sola instancia. Para
 * varias instancias habria que respaldarlos en Redis/Hazelcast.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RateLimitFilter extends OncePerRequestFilter {

    /** Tiempo sin trafico tras el cual se olvida un contador. */
    private static final Duration TTL_INACTIVIDAD = Duration.ofMinutes(30);

    /** Tope de contadores distintos en memoria antes de forzar una limpieza. */
    private static final int MAX_ENTRADAS = 50_000;

    /** Cada cuantas peticiones se revisa si toca limpiar. */
    private static final int PERIODO_REVISION = 1_000;

    /**
     * Rutas con el limite estricto anti fuerza bruta. Son las que aceptan una
     * credencial y, al fallar, dan pistas a quien la esta adivinando.
     *
     * <p><strong>El refresh no esta aqui, y es deliberado.</strong> Antes se
     * aplicaba el limite estricto a todo {@code /api/v1/auth}, refresh incluido,
     * y eso convertia el mantenimiento normal de la sesion en trafico
     * sospechoso: una pantalla que dispara varias llamadas a la vez con el
     * token recien vencido gasta varios refrescos de golpe y agota los cinco
     * del minuto. Renovar una sesion que ya esta autenticada no es adivinar una
     * contrasena; su sitio es el limite general de la API.
     */
    private static final String[] RUTAS_DE_CREDENCIAL = {
            "/api/v1/auth/login",
            "/api/v1/auth/forgot-password",
            "/api/v1/auth/reset-password",
    };

    private static boolean esRutaDeCredencial(String uri) {
        for (String ruta : RUTAS_DE_CREDENCIAL) {
            if (uri.startsWith(ruta)) {
                return true;
            }
        }
        return false;
    }

    /** El webhook de Meta se excluye del limite general: Meta reintenta
     *  agresivamente cuando ve un 429, y su autenticacion ya es la firma. */
    private static boolean esWebhookWhatsapp(String uri) {
        return uri.startsWith("/api/v1/whatsapp/webhook");
    }

    private final int loginMax;
    private final int loginWindowMinutes;
    private final int apiMax;
    private final int apiWindowMinutes;

    private final ClientIpResolver clientIpResolver;

    private final Map<String, Contador> loginBuckets = new ConcurrentHashMap<>();
    private final Map<String, Contador> apiBuckets = new ConcurrentHashMap<>();
    private final AtomicLong peticionesDesdeUltimaRevision = new AtomicLong();

    public RateLimitFilter(
            @Value("${app.rate-limit.login-max:5}") int loginMax,
            @Value("${app.rate-limit.login-window-minutes:1}") int loginWindowMinutes,
            @Value("${app.rate-limit.api-max:100}") int apiMax,
            @Value("${app.rate-limit.api-window-minutes:1}") int apiWindowMinutes,
            @Value("${app.rate-limit.trusted-proxies:}") String trustedProxies) {
        this.loginMax = loginMax;
        this.loginWindowMinutes = loginWindowMinutes;
        this.apiMax = apiMax;
        this.apiWindowMinutes = apiWindowMinutes;
        this.clientIpResolver = new ClientIpResolver(trustedProxies);
    }

    /** Bucket con marca de ultimo uso, para poder descartarlo cuando caduque. */
    private static final class Contador {
        private final Bucket bucket;
        private volatile long ultimoUsoNanos;

        Contador(Bucket bucket) {
            this.bucket = bucket;
            this.ultimoUsoNanos = System.nanoTime();
        }

        boolean consumir() {
            this.ultimoUsoNanos = System.nanoTime();
            return bucket.tryConsume(1);
        }

        boolean caducado(long ahoraNanos, long ttlNanos) {
            return ahoraNanos - ultimoUsoNanos > ttlNanos;
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String uri = request.getRequestURI();

        Map<String, Contador> registro;
        int max;
        int ventanaMinutos;

        if (esRutaDeCredencial(uri)) {
            registro = loginBuckets;
            max = loginMax;
            ventanaMinutos = loginWindowMinutes;
        } else if (uri.startsWith("/api/") && !esWebhookWhatsapp(uri)) {
            registro = apiBuckets;
            max = apiMax;
            ventanaMinutos = apiWindowMinutes;
        } else {
            chain.doFilter(request, response);
            return;
        }

        limpiarSiCorresponde();

        // El login cuenta por IP a proposito: todavia no hay token, y es
        // justamente la IP lo que hay que frenar contra la fuerza bruta.
        String clave = registro == loginBuckets
                ? clientIpResolver.resolver(request)
                : identidadApi(request);
        final int maxFinal = max;
        final int ventanaFinal = ventanaMinutos;
        Contador contador = registro.computeIfAbsent(clave,
                k -> new Contador(nuevoBucket(maxFinal, ventanaFinal)));

        if (!contador.consumir()) {
            response.setStatus(429);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.setHeader("Retry-After", String.valueOf(ventanaMinutos * 60L));
            response.getWriter().write(
                    "{\"error\":\"Demasiadas peticiones. Intenta de nuevo mas tarde.\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    /**
     * Con que contador se asocia una peticion de la API. Las llamadas
     * autenticadas cuentan por usuario, no por IP.
     *
     * <p>El centro de formacion sale a internet por una sola direccion, asi que
     * con el contador por IP los ~108 estudiantes compartian un unico cubo de
     * {@code api-max}. Entre las pantallas que refrescan solas eso se agota sin
     * que nadie abuse, y el 429 le toca a quien pase por ahi. Por usuario, el
     * limite vuelve a medir lo que dice medir.
     *
     * <p>Solo cuenta como usuario un access token con firma valida. Un token
     * inventado cae al contador por IP: si no, bastaria con cambiar la cabecera
     * en cada peticion para estrenar cubo y saltarse el limite entero.
     */
    private String identidadApi(HttpServletRequest request) {
        String cabecera = request.getHeader("Authorization");
        if (cabecera != null && cabecera.startsWith("Bearer ")) {
            try {
                SecretKey clave = Keys.hmacShaKeyFor(
                        SecurityConfig.jwtSecretActivo().getBytes(StandardCharsets.UTF_8));
                Claims claims = Jwts.parser().verifyWith(clave).build()
                        .parseSignedClaims(cabecera.substring(7))
                        .getPayload();
                if (JwtClaims.TYPE_ACCESS.equals(claims.get(JwtClaims.TYPE, String.class))
                        && claims.getSubject() != null) {
                    return "u:" + claims.getSubject();
                }
            } catch (Exception e) {
                // Token ilegible, caducado o de refresco. Rechazarlo es tarea
                // del filtro de seguridad; aqui solo significa "no se quien
                // eres", y quien no se identifica cuenta por su IP.
            }
        }
        return "ip:" + clientIpResolver.resolver(request);
    }

    /**
     * Descarta los contadores inactivos. Sin esto los mapas crecen sin limite:
     * una IP vista una sola vez se quedaria en memoria para siempre, y combinado
     * con la cabecera falseable era un camino directo a agotar la memoria.
     */
    private void limpiarSiCorresponde() {
        boolean llenos = loginBuckets.size() + apiBuckets.size() > MAX_ENTRADAS;
        boolean tocaPorPeriodo =
                peticionesDesdeUltimaRevision.incrementAndGet() >= PERIODO_REVISION;

        if (!llenos && !tocaPorPeriodo) {
            return;
        }
        peticionesDesdeUltimaRevision.set(0);

        long ahora = System.nanoTime();
        long ttl = TTL_INACTIVIDAD.toNanos();
        loginBuckets.values().removeIf(c -> c.caducado(ahora, ttl));
        apiBuckets.values().removeIf(c -> c.caducado(ahora, ttl));

        // Si aun asi siguen llenos se vacian: es preferible perder contadores
        // (peor caso, alguien recupera intentos) a quedarse sin memoria.
        if (loginBuckets.size() + apiBuckets.size() > MAX_ENTRADAS) {
            loginBuckets.clear();
            apiBuckets.clear();
        }
    }

    private Bucket nuevoBucket(int max, int windowMinutes) {
        Bandwidth limite = Bandwidth.classic(max, Refill.greedy(max, Duration.ofMinutes(windowMinutes)));
        return Bucket.builder().addLimit(limite).build();
    }

    /** Numero de contadores vivos. Solo para las pruebas. */
    int contadoresVivos() {
        return loginBuckets.size() + apiBuckets.size();
    }
}
