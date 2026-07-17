package com.novacrm.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate limiting por IP con bucket4j. Aplica un limite estricto al login (anti fuerza
 * bruta) y otro mas amplio al resto de la API. Los limites se configuran en
 * {@code app.rate-limit.*}. En memoria: suficiente para una sola instancia; para
 * multi-instancia habria que respaldarlo en Redis/Hazelcast.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RateLimitFilter extends OncePerRequestFilter {

    private final int loginMax;
    private final int loginWindowMinutes;
    private final int apiMax;
    private final int apiWindowMinutes;

    private final Map<String, Bucket> loginBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> apiBuckets = new ConcurrentHashMap<>();

    public RateLimitFilter(
            @Value("${app.rate-limit.login-max:5}") int loginMax,
            @Value("${app.rate-limit.login-window-minutes:1}") int loginWindowMinutes,
            @Value("${app.rate-limit.api-max:100}") int apiMax,
            @Value("${app.rate-limit.api-window-minutes:1}") int apiWindowMinutes) {
        this.loginMax = loginMax;
        this.loginWindowMinutes = loginWindowMinutes;
        this.apiMax = apiMax;
        this.apiWindowMinutes = apiWindowMinutes;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String uri = request.getRequestURI();
        Bucket bucket = null;
        String ip = clientIp(request);

        if (uri.startsWith("/api/v1/auth")) {
            bucket = loginBuckets.computeIfAbsent(ip,
                    k -> nuevoBucket(loginMax, loginWindowMinutes));
        } else if (uri.startsWith("/api/")) {
            bucket = apiBuckets.computeIfAbsent(ip,
                    k -> nuevoBucket(apiMax, apiWindowMinutes));
        }

        if (bucket != null && !bucket.tryConsume(1)) {
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Demasiadas peticiones. Intenta de nuevo mas tarde.\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    private Bucket nuevoBucket(int max, int windowMinutes) {
        Bandwidth limite = Bandwidth.classic(max, Refill.greedy(max, Duration.ofMinutes(windowMinutes)));
        return Bucket.builder().addLimit(limite).build();
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
