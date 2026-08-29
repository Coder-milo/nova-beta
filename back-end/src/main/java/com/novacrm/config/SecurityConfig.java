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
            "super_secret_jwt_key_nova_crm_2026_default_secret_key_32bytes",
            "dev_jwt_secret_key_nova_crm_min_32_bytes_long_for_security_2026");

    /** Clave validada que permite compartir un secreto efimero local. */
    private static volatile String jwtSecretActivo;

    @Value("${app.jwt.secret:}")
    private String jwtSecret;

    @Value("${app.jwt.allow-ephemeral-secret:true}")
    private boolean allowEphemeralSecret;

    @jakarta.annotation.PostConstruct
    void validarJwtSecret() {
        if (jwtSecret == null || jwtSecret.isBlank() || jwtSecret.getBytes(StandardCharsets.UTF_8).length < LONGITUD_MINIMA_SECRETO) {
            if (allowEphemeralSecret) {
                byte[] bytes = new byte[48];
                new SecureRandom().nextBytes(bytes);
                jwtSecret = Base64.getEncoder().encodeToString(bytes);
                jwtSecretActivo = jwtSecret;
                log.warn("Usando una clave JWT efimera para desarrollo local; las sesiones se invalidaran al reiniciar.");
                return;
            }
            throw new IllegalStateException(
                    "La variable de entorno JWT_SECRET es obligatoria y debe tener al menos 32 bytes.");
        }
        if (SECRETOS_COMPROMETIDOS.contains(jwtSecret.trim())) {
            throw new IllegalStateException(
                    "JWT_SECRET tiene un valor que estuvo publicado en el repositorio y ya no es secreto. "
                            + "Genera uno nuevo con: openssl rand -base64 32");
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
                // La consola técnica se aísla del CRM: la cuenta de
                // desarrollador solo puede leer este diagnóstico seguro.
                .requestMatchers("/api/v1/desarrollador/**").hasRole("DESARROLLADOR")
                .requestMatchers("/credencial/**").permitAll()
                .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
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
                // El webhook de WhatsApp lo llama Meta, no el navegador. Su
                // seguridad es la firma HMAC (X-Hub-Signature-256), no una
                // sesion; un JWT aqui solo conseguiria que Meta no pueda entrar.
                .requestMatchers("/api/v1/whatsapp/webhook").permitAll()
                // El formulario de captacion: una empresa que llega por su
                // cuenta no tiene cuenta con que entrar, y las cuentas del
                // portal son por invitacion. Solo POST y solo esa ruta —no
                // "/publico/**" entero— para que un GET que alguien añada
                // manana al lado no herede la exposicion.
                //
                // Su defensa no es la sesion sino, por este orden: el limite
                // estricto por IP de RateLimitFilter, que no lee ninguna URL ni
                // manda ningun correo, y que lo que entra nace sin revisar y no
                // se ve hasta que una persona lo aprueba.
                .requestMatchers(HttpMethod.POST, "/api/v1/publico/vacantes").permitAll()
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
                // El portal de empresas es lo unico que puede tocar el rol
                // EMPRESA, y es lo unico que ese rol puede tocar. La regla se
                // escribe en los dos sentidos a proposito: sin la segunda
                // mitad, una cuenta de empresa autenticada caeria en
                // `anyRequest().authenticated()` y alcanzaria cualquier
                // endpoint que no exija rol por su cuenta.
                //
                // Aqui solo se comprueba quien entra. De quien son los datos lo
                // decide `AccesoDelPortal`, porque una URL no sabe a que
                // empresa pertenece la vacante que pide.
                .requestMatchers("/api/v1/portal/**").hasRole("EMPRESA")
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .anyRequest().access((quienPregunta, ctx) -> {
                    var a = quienPregunta.get();
                    boolean esEmpresa = a != null && a.isAuthenticated()
                            && a.getAuthorities().stream()
                                .anyMatch(g -> "ROLE_EMPRESA".equals(g.getAuthority()));
                    boolean esDesarrollador = a != null && a.isAuthenticated()
                            && a.getAuthorities().stream()
                                .anyMatch(g -> "ROLE_DESARROLLADOR".equals(g.getAuthority()));
                    // Una cuenta de empresa fuera de /portal no pasa: es un
                    // tercero, y todo lo demas son datos de la institucion.
                    // El mismo cierre explícito aplica a quien mantiene la
                    // plataforma: un diagnóstico técnico no debe abrir el CRM.
                    return new org.springframework.security.authorization.AuthorizationDecision(
                            a != null && a.isAuthenticated() && !esEmpresa && !esDesarrollador);
                })
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
                        log.warn("Token JWT rechazado en {} {}: {}",
                                request.getMethod(), request.getRequestURI(), e.getMessage());
                        org.springframework.security.core.context.SecurityContextHolder.clearContext();
                    }
                }
                chain.doFilter(request, response);
            }
        };
    }
}
