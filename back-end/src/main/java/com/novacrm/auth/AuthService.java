package com.novacrm.auth;

import com.novacrm.config.EmailService;
import com.novacrm.config.SecurityConfig;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.CredencialesInvalidasException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.HexFormat;

@Service
@Transactional(readOnly = true)
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String CREDENCIALES_INVALIDAS = "Correo o contrasena incorrectos";

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Value("${app.jwt.secret:}")
    private String jwtSecret;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpiration;

    @Value("${app.jwt.refresh-expiration-ms}")
    private long refreshExpiration;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    /**
     * Vigencia del enlace de restablecimiento. La constante existe para que el
     * correo diga el mismo número que aplica el código: cuando estaban por
     * separado, el texto podía prometer una vigencia que ya no era la real.
     */
    private static final int MINUTOS_VIGENCIA_RESET = 30;

    private final com.novacrm.correo.MarcaCorreoService marcaCorreoService;

    public AuthService(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder,
                       EmailService emailService,
                       com.novacrm.correo.MarcaCorreoService marcaCorreoService) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.marcaCorreoService = marcaCorreoService;
    }

    /**
     * Los tres fracasos posibles responden 401 con el mismo texto: distinguir
     * "ese correo no existe" de "la contrasena no es esa" permite averiguar
     * quien tiene cuenta probando correos.
     */
    @Transactional
    public LoginResponse login(LoginRequest request) {
        var usuario = usuarioRepository.findByEmail(request.email())
                .orElseThrow(() -> new CredencialesInvalidasException(CREDENCIALES_INVALIDAS));

        if (!passwordEncoder.matches(request.password(), usuario.getPassword())) {
            throw new CredencialesInvalidasException(CREDENCIALES_INVALIDAS);
        }

        if (!usuario.isActivo()) {
            throw new CredencialesInvalidasException(CREDENCIALES_INVALIDAS);
        }

        return respuestaConTokens(usuario);
    }

    /** Emite un nuevo access token a partir de un refresh token válido. */
    public LoginResponse refresh(String refreshToken) {
        Claims claims;
        try {
            SecretKey key = Keys.hmacShaKeyFor(secretJwt().getBytes(StandardCharsets.UTF_8));
            claims = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(refreshToken).getPayload();
        } catch (Exception e) {
            throw new CredencialesInvalidasException("Refresh token invalido o expirado");
        }
        if (!JwtClaims.TYPE_REFRESH.equals(claims.get(JwtClaims.TYPE, String.class))) {
            throw new CredencialesInvalidasException("El token no es un refresh token");
        }
        var usuario = usuarioRepository.findByEmail(claims.getSubject())
                .filter(Usuario::isActivo)
                .orElseThrow(() -> new CredencialesInvalidasException("Usuario no valido"));
        return respuestaConTokens(usuario);
    }

    /** Genera el token de recuperación y envía el correo. Silencioso ante emails desconocidos. */
    @Transactional
    public void forgotPassword(String email) {
        usuarioRepository.findByEmail(email).filter(Usuario::isActivo).ifPresent(usuario -> {
            byte[] bytes = new byte[32];
            RANDOM.nextBytes(bytes);
            String token = HexFormat.of().formatHex(bytes);
            usuario.setResetToken(token);
            usuario.setResetTokenExpira(LocalDateTime.now().plusMinutes(MINUTOS_VIGENCIA_RESET));

            String enlace = frontendUrl + "/recuperar-contrasena?token=" + token;
            try {
                // Pasa por la plantilla de marca, igual que el de activación. Antes
                // se concatenaba aquí a mano y salía sin cabecera, sin pie y sin
                // color: el mismo usuario recibía dos correos que no parecían del
                // mismo sistema, y el de recuperación tenía toda la pinta de
                // suplantación.
                emailService.enviar(usuario.getEmail(), "Recupera tu contraseña — NOVA CRM",
                        com.novacrm.correo.CorreosDelSistema.recuperacion(
                                usuario.getNombre(), enlace, MINUTOS_VIGENCIA_RESET,
                                marcaCorreoService.global()));
            } catch (Exception e) {
                // No propagar: en desarrollo (sin SES) el token queda en el log.
                log.warn("No se pudo enviar el correo de recuperación a {}: {}. Enlace: {}",
                        usuario.getEmail(), e.getMessage(), enlace);
            }
        });
    }

    @Transactional
    public void resetPassword(String token, String nuevaPassword) {
        var usuario = usuarioRepository.findByResetToken(token)
                .orElseThrow(() -> new BusinessException("El enlace de recuperación no es válido"));
        if (usuario.getResetTokenExpira() == null || usuario.getResetTokenExpira().isBefore(LocalDateTime.now())) {
            throw new BusinessException("El enlace de recuperación expiró. Solicita uno nuevo");
        }
        usuario.setPassword(passwordEncoder.encode(nuevaPassword));
        usuario.setResetToken(null);
        usuario.setResetTokenExpira(null);
    }

    private LoginResponse respuestaConTokens(Usuario usuario) {
        return new LoginResponse(generarToken(usuario), generarRefreshToken(usuario),
                usuario.getId(), usuario.getEmail(), usuario.getNombre(), usuario.getRoles());
    }

    private String generarToken(Usuario usuario) {
        SecretKey key = Keys.hmacShaKeyFor(secretJwt().getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject(usuario.getEmail())
                .claim(JwtClaims.TYPE, JwtClaims.TYPE_ACCESS)
                .claim("usuarioId", usuario.getId().toString())
                .claim("roles", usuario.getRoles().stream().map(Enum::name).toList())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtExpiration))
                .signWith(key)
                .compact();
    }

    private String generarRefreshToken(Usuario usuario) {
        SecretKey key = Keys.hmacShaKeyFor(secretJwt().getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject(usuario.getEmail())
                .claim(JwtClaims.TYPE, JwtClaims.TYPE_REFRESH)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + refreshExpiration))
                .signWith(key)
                .compact();
    }

    private String secretJwt() {
        if (jwtSecret != null && !jwtSecret.isBlank() && jwtSecret.getBytes(StandardCharsets.UTF_8).length >= 32) {
            return jwtSecret;
        }
        return SecurityConfig.jwtSecretActivo();
    }
}
