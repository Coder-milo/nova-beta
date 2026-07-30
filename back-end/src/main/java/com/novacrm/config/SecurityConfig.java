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
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(SecurityConfig.class);
    private static final int LONGITUD_MINIMA_SECRETO = 32;
    private static final java.util.Set<String> SECRETOS_COMPROMETIDOS = java.util.Set.of(
            "TlfnNVy2SjMmDUao7a6XpWTBRG4iLr3ZGdveIrsy/o0=",
            "super_secret_jwt_key_nova_crm_2026_default_secret_key_32bytes");

    /** Clave validada que permite compartir un secreto efimero local. */
    private static volatile String jwtSecretActivo;

    @Value("${app.jwt.secret:}")
    private String jwtSecret;

    @Value("${app.jwt.allow-ephemeral-secret:false}")
    private boolean allowEphemeralSecret;

    @jakarta.annotation.PostConstruct
    void validarJwtSecret() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            if (allowEphemeralSecret) {
                byte[] bytes = new byte[48];
                new SecureRandom().nextBytes(bytes);
                jwtSecret = Base64.getEncoder().encodeToString(bytes);
                jwtSecretActivo = jwtSecret;
                log.warn("Usando una clave JWT efimera para desarrollo local; las sesiones se invalidaran al reiniciar.");
                return;
            }
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
        jwtSecretActivo = jwtSecret;
    }

    public static String jwtSecretActivo() {
        if (jwtSecretActivo == null || jwtSecretActivo.isBlank()) {
            throw new IllegalStateException("La clave JWT aun no esta inicializada");
        }
        return jwtSecretActivo;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(Customizer.withDefaults())
            .headers(headers -> headers
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000)
                )
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**").permitAll()
                // Defensa en profundidad: además del @PreAuthorize de los controllers.
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/v1/usuarios/**").hasRole("ADMIN")
                .requestMatchers("/credencial/**").permitAll()
                .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").hasAnyRole("ADMIN", "COORDINADOR")
                .requestMatchers("/actuator/health").permitAll()
                // Solo las imagenes de marca, no todo /branding: las abre el
                // cliente de correo del destinatario, que no tiene sesion ni la
                // puede tener. La clave se valida por lista blanca antes de
                // tocar el disco (ImagenBrandingService.claveSegura).
                .requestMatchers(HttpMethod.GET, "/api/v1/branding/imagen/**").permitAll()
                // Los adjuntos de un anuncio si son publicos: los abre el
                // cliente de correo o la etiqueta img de la notificacion, que no
                // pueden adjuntar un JWT. La clave se valida por lista blanca
                // (AnuncioMediaService.claveSegura) antes de tocar el disco.
                .requestMatchers(HttpMethod.GET, "/api/v1/notificaciones/adjunto/**").permitAll()
                // Programas, vacantes y certificaciones estaban en permitAll, y
                // no deben estarlo: exponian el catalogo de proyectos, sus
                // clientes y las credenciales emitidas a cualquiera que supiera
                // la ruta. Los controllers ya exigian rol con @PreAuthorize, asi
                // que el permitAll solo servia para que la primera barrera no
                // coincidiera con la segunda. La verificacion publica de una
                // credencial no pasa por aqui: vive en /credencial/**.
                .requestMatchers(HttpMethod.GET, "/api/v1/programas/**").hasAnyRole("ADMIN", "COORDINADOR", "ESTUDIANTE")
                .requestMatchers(HttpMethod.GET, "/api/v1/vacantes/**").hasAnyRole("ADMIN", "COORDINADOR", "ESTUDIANTE")
                .requestMatchers(HttpMethod.GET, "/api/v1/certificaciones/**").hasAnyRole("ADMIN", "COORDINADOR", "ESTUDIANTE")
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
