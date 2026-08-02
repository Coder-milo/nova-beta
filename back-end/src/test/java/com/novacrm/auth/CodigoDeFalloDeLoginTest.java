package com.novacrm.auth;

import com.novacrm.config.EmailService;
import com.novacrm.exception.CredencialesInvalidasException;
import com.novacrm.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Un login fallido responde 401, no 400.
 *
 * <p>Lo lanzaba una {@code BusinessException}, que el manejador global traduce a
 * 400. La pantalla de login solo reconoce 401 y 403 como «credenciales
 * incorrectas», asi que a quien tecleaba mal la contrasena le salia «El servidor
 * respondio con un error (400). Intenta mas tarde»: el usuario esperaba a que se
 * arreglara un servidor que nunca estuvo roto.
 *
 * <p>El otro 400 que puede devolver este endpoint es el de validacion —email con
 * mala forma—, y por eso el codigo tenia que separarse: con ambos casos saliendo
 * como 400, el navegador no puede distinguirlos.
 */
class CodigoDeFalloDeLoginTest {

    private static final String SECRETO = "secreto-de-pruebas-con-mas-de-32-bytes-de-longitud";

    private UsuarioRepository usuarios;
    private PasswordEncoder encoder;
    private AuthService authService;

    @BeforeEach
    void configurar() {
        usuarios = mock(UsuarioRepository.class);
        encoder = mock(PasswordEncoder.class);
        authService = new AuthService(usuarios, encoder, mock(EmailService.class),
                mock(com.novacrm.correo.MarcaCorreoService.class));
        ReflectionTestUtils.setField(authService, "jwtSecret", SECRETO);
        ReflectionTestUtils.setField(authService, "jwtExpiration", 28_800_000L);
        ReflectionTestUtils.setField(authService, "refreshExpiration", 604_800_000L);
    }

    private Usuario usuario(boolean activo) {
        var usuario = new Usuario();
        usuario.setId(UUID.randomUUID());
        usuario.setEmail("admin@novacrm.com");
        usuario.setNombre("Admin");
        usuario.setPassword("$2a$10$hash");
        usuario.setRoles(Set.of(Rol.ADMIN));
        usuario.setActivo(activo);
        return usuario;
    }

    @Test
    void unaContrasenaIncorrectaEsCredencialInvalida() {
        when(usuarios.findByEmail("admin@novacrm.com")).thenReturn(Optional.of(usuario(true)));
        when(encoder.matches(anyString(), anyString())).thenReturn(false);

        assertThrows(CredencialesInvalidasException.class,
                () -> authService.login(new LoginRequest("admin@novacrm.com", "la-que-no-es")));
    }

    @Test
    void unCorreoQueNoExisteEsCredencialInvalida() {
        when(usuarios.findByEmail(anyString())).thenReturn(Optional.empty());

        assertThrows(CredencialesInvalidasException.class,
                () -> authService.login(new LoginRequest("nadie@novacrm.com", "cualquiera")));
    }

    @Test
    void unaCuentaDesactivadaEsCredencialInvalida() {
        when(usuarios.findByEmail(anyString())).thenReturn(Optional.of(usuario(false)));
        when(encoder.matches(anyString(), anyString())).thenReturn(true);

        assertThrows(CredencialesInvalidasException.class,
                () -> authService.login(new LoginRequest("admin@novacrm.com", "la-buena")));
    }

    /**
     * Los tres fracasos dicen lo mismo. Distinguir «ese correo no existe» de
     * «la contrasena no es esa» permite averiguar quien tiene cuenta probando
     * correos, y aqui las cuentas son de estudiantes reales.
     */
    @Test
    void losTresFracasosDicenLoMismo() {
        when(usuarios.findByEmail("admin@novacrm.com")).thenReturn(Optional.of(usuario(true)));
        when(encoder.matches(anyString(), anyString())).thenReturn(false);
        String porContrasena = assertThrows(CredencialesInvalidasException.class,
                () -> authService.login(new LoginRequest("admin@novacrm.com", "mala"))).getMessage();

        when(usuarios.findByEmail("nadie@novacrm.com")).thenReturn(Optional.empty());
        String porInexistente = assertThrows(CredencialesInvalidasException.class,
                () -> authService.login(new LoginRequest("nadie@novacrm.com", "mala"))).getMessage();

        when(usuarios.findByEmail("apagado@novacrm.com")).thenReturn(Optional.of(usuario(false)));
        when(encoder.matches(anyString(), anyString())).thenReturn(true);
        String porInactivo = assertThrows(CredencialesInvalidasException.class,
                () -> authService.login(new LoginRequest("apagado@novacrm.com", "buena"))).getMessage();

        assertEquals(porContrasena, porInexistente);
        assertEquals(porContrasena, porInactivo);
    }

    /** El guardian de verdad: el codigo HTTP que ve el navegador. */
    @Test
    void elManejadorGlobalLoTraduceA401() {
        var respuesta = new GlobalExceptionHandler()
                .handleCredenciales(new CredencialesInvalidasException("Correo o contrasena incorrectos"));

        assertEquals(HttpStatus.UNAUTHORIZED, respuesta.getStatusCode());
        assertEquals("UNAUTHORIZED", respuesta.getBody().code());
    }

    /**
     * Un refresh token que ya no vale tambien es 401. El proxy del front ya
     * trataba 400, 401 y 403 igual para este caso, asi que el cambio no rompe
     * la renovacion de sesion.
     */
    @Test
    void unRefreshTokenInvalidoEsCredencialInvalida() {
        assertThrows(CredencialesInvalidasException.class,
                () -> authService.refresh("esto-no-es-un-jwt"));
    }

    /** Un login correcto sigue devolviendo los dos tokens. */
    @Test
    void elLoginCorrectoSigueFuncionando() {
        when(usuarios.findByEmail("admin@novacrm.com")).thenReturn(Optional.of(usuario(true)));
        when(encoder.matches(anyString(), anyString())).thenReturn(true);

        var respuesta = authService.login(new LoginRequest("admin@novacrm.com", "la-buena"));

        assertNotNull(respuesta.token());
        assertNotNull(respuesta.refreshToken());
        assertEquals("admin@novacrm.com", respuesta.email());
    }
}
