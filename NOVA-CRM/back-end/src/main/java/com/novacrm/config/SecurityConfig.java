package com.novacrm.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

import com.novacrm.auth.JwtClaims;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    /** Longitud minima exigida por HMAC-SHA256 (RFC 7518, seccion 3.2). */
    private static final int LONGITUD_MINIMA_SECRETO = 32;

    /**
     * Secretos que estuvieron versionados en el repositorio. Se rechazan de forma
     * explicita: cualquiera con acceso al codigo podria firmar tokens validos.
     */
    private static final java.util.Set<String> SECRETOS_COMPROMETIDOS = java.util.Set.of(
            "TlfnNVy2SjMmDUao7a6XpWTBRG4iLr3ZGdveIrsy/o0=",
            "super_secret_jwt_key_nova_crm_2026_default_secret_key_32bytes");

    @Value("${app.jwt.secret:}")
    private String jwtSecret;

    @jakarta.annotation.PostConstruct
    void validarJwtSecret() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException(
                    "La variable de entorno JWT_SECRET es obligatoria. Genera una con: openssl rand -base64 32");
        }
        if (SECRETOS_COMPROMETIDOS.contains(jwtSecret.trim())) {
            throw new IllegalStateException(
                    "JWT_SECRET tiene un valor que estuvo publicado en el repositorio y ya no es secreto. "
                            + "Genera uno nuevo con: openssl rand -base64 32");
        }
        if (jwtSecret.getBytes(StandardCharsets.UTF_8).length < LONGITUD_MINIMA_SECRETO) {
            throw new IllegalStateException(
                    "JWT_SECRET debe tener al menos " + LONGITUD_MINIMA_SECRETO
                            + " bytes. Genera uno con: openssl rand -base64 32");
        }
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(Customizer.withDefaults())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**").permitAll()
                // Defensa en profundidad: además del @PreAuthorize de los controllers.
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/v1/usuarios/**").hasRole("ADMIN")
                .requestMatchers("/credencial/**").permitAll()
                .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                // Solo las imagenes de marca, no todo /branding: las abre el
                // cliente de correo del destinatario, que no tiene sesion ni la
                // puede tener. La clave se valida por lista blanca antes de
                // tocar el disco (ImagenBrandingService.claveSegura).
                .requestMatchers(HttpMethod.GET, "/api/v1/branding/imagen/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/programas/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/vacantes/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/certificaciones/**").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter(), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public OncePerRequestFilter jwtFilter() {
        return new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request,
                                            HttpServletResponse response,
                                            FilterChain chain) throws ServletException, IOException {
                String header = request.getHeader("Authorization");
                if (header != null && header.startsWith("Bearer ")) {
                    try {
                        String token = header.substring(7);
                        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
                        Claims claims = Jwts.parser()
                                .verifyWith(key)
                                .build()
                                .parseSignedClaims(token)
                                .getPayload();

                        // Solo el access token autentica. El refresh token esta firmado
                        // con la misma clave, pero sirve unicamente en /auth/refresh.
                        if (!JwtClaims.TYPE_ACCESS.equals(claims.get(JwtClaims.TYPE, String.class))) {
                            throw new io.jsonwebtoken.JwtException(
                                    "El token no es un access token");
                        }

                        List<?> roles = claims.get("roles") instanceof List<?> lista ? lista : List.of();
                        var auth = new org.springframework.security.authentication
                                .UsernamePasswordAuthenticationToken(
                                claims.getSubject(), null,
                                roles.stream()
                                        .map(r -> new org.springframework.security.core.authority
                                                .SimpleGrantedAuthority("ROLE_" + r))
                                        .toList());
                        auth.setDetails(claims);
                        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
                    } catch (Exception e) {
                        org.springframework.security.core.context.SecurityContextHolder.clearContext();
                    }
                }
                chain.doFilter(request, response);
            }
        };
    }
}
