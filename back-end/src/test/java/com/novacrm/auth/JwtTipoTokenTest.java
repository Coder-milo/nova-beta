package com.novacrm.auth;

import com.novacrm.config.EmailService;
import com.novacrm.config.SecurityConfig;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/**
 * Un refresh token esta firmado con la misma clave que el access token, asi que
 * la firma por si sola no basta para distinguirlos. Estos tests fijan que solo
 * el access token autentica: sin ellos, un refresh token (vigencia de dias)
 * serviria como credencial en cualquier endpoint autenticado.
 */
class JwtTipoTokenTest {

    private static final String SECRETO = "secreto-de-pruebas-con-mas-de-32-bytes-de-longitud";

    private AuthService authService;
    private SecurityConfig securityConfig;

    @BeforeEach
    void configurar() {
        authService = new AuthService(
                mock(UsuarioRepository.class), mock(org.springframework.security.crypto.password.PasswordEncoder.class),
                mock(EmailService.class));
        ReflectionTestUtils.setField(authService, "jwtSecret", SECRETO);
        ReflectionTestUtils.setField(authService, "jwtExpiration", 28_800_000L);
        ReflectionTestUtils.setField(authService, "refreshExpiration", 604_800_000L);

        securityConfig = new SecurityConfig();
        ReflectionTestUtils.setField(securityConfig, "jwtSecret", SECRETO);

        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void limpiar() {
        SecurityContextHolder.clearContext();
    }

    private Usuario usuarioDePrueba() {
        var usuario = new Usuario();
        usuario.setId(UUID.randomUUID());
        usuario.setEmail("coordinador@novacrm.com");
        usuario.setNombre("Coordinador");
        usuario.setRoles(Set.of(Rol.COORDINADOR));
        usuario.setActivo(true);
        return usuario;
    }

    /** Ejecuta el filtro JWT con el token dado y devuelve si quedo autenticado. */
    private boolean autenticaCon(String token) throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + token);
        securityConfig.jwtFilter().doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
        return SecurityContextHolder.getContext().getAuthentication() != null;
    }

    @Test
    void elAccessTokenLlevaElClaimTypeAccess() {
        String accessToken = (String) ReflectionTestUtils.invokeMethod(
                authService, "generarToken", usuarioDePrueba());

        assertEquals(JwtClaims.TYPE_ACCESS, claimsDe(accessToken).get(JwtClaims.TYPE, String.class));
    }

    @Test
    void elRefreshTokenLlevaElClaimTypeRefresh() {
        String refreshToken = (String) ReflectionTestUtils.invokeMethod(
                authService, "generarRefreshToken", usuarioDePrueba());

        assertEquals(JwtClaims.TYPE_REFRESH, claimsDe(refreshToken).get(JwtClaims.TYPE, String.class));
    }

    @Test
    void elAccessTokenAutenticaYConservaLosRoles() throws Exception {
        String accessToken = (String) ReflectionTestUtils.invokeMethod(
                authService, "generarToken", usuarioDePrueba());

        assertTrue(autenticaCon(accessToken), "el access token deberia autenticar");
        assertTrue(SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                        .anyMatch(a -> a.getAuthority().equals("ROLE_COORDINADOR")),
                "el access token deberia conservar los roles del usuario");
    }

    @Test
    void elRefreshTokenNoAutentica() throws Exception {
        String refreshToken = (String) ReflectionTestUtils.invokeMethod(
                authService, "generarRefreshToken", usuarioDePrueba());

        assertFalse(autenticaCon(refreshToken),
                "un refresh token no debe servir como credencial de acceso");
    }

    @Test
    void unTokenSinClaimTypeNoAutentica() throws Exception {
        SecretKey key = Keys.hmacShaKeyFor(SECRETO.getBytes(StandardCharsets.UTF_8));
        String tokenLegado = Jwts.builder()
                .subject("coordinador@novacrm.com")
                .claim("roles", java.util.List.of("ADMIN"))
                .expiration(new java.util.Date(System.currentTimeMillis() + 60_000))
                .signWith(key)
                .compact();

        assertFalse(autenticaCon(tokenLegado),
                "un token sin claim type no debe autenticar aunque este bien firmado");
    }

    private Claims claimsDe(String token) {
        return Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(SECRETO.getBytes(StandardCharsets.UTF_8)))
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
