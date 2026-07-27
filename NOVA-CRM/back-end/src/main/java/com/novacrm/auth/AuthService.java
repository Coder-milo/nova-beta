package com.novacrm.auth;

import com.novacrm.config.EmailService;
import com.novacrm.exception.BusinessException;
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

    public AuthService(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder,
                       EmailService emailService) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        var usuario = usuarioRepository.findByEmail(request.email())
                .orElseThrow(() -> new BusinessException("Credenciales invalidas"));

        if (!passwordEncoder.matches(request.password(), usuario.getPassword())) {
            throw new BusinessException("Credenciales invalidas");
        }

        if (!usuario.isActivo()) {
            throw new BusinessException("Usuario inactivo");
        }

        return respuestaConTokens(usuario);
    }

    /** Emite un nuevo access token a partir de un refresh token válido. */
    public LoginResponse refresh(String refreshToken) {
        Claims claims;
        try {
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
            claims = Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(refreshToken).getPayload();
        } catch (Exception e) {
            throw new BusinessException("Refresh token invalido o expirado");
        }
        if (!JwtClaims.TYPE_REFRESH.equals(claims.get(JwtClaims.TYPE, String.class))) {
            throw new BusinessException("El token no es un refresh token");
        }
        var usuario = usuarioRepository.findByEmail(claims.getSubject())
                .filter(Usuario::isActivo)
                .orElseThrow(() -> new BusinessException("Usuario no valido"));
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
            usuario.setResetTokenExpira(LocalDateTime.now().plusMinutes(30));

            String enlace = frontendUrl + "/recuperar-contrasena?token=" + token;
            try {
                emailService.enviar(usuario.getEmail(), "Recupera tu contraseña — NOVA CRM",
                        "<p>Hola " + usuario.getNombre() + ",</p>"
                        + "<p>Recibimos una solicitud para restablecer tu contraseña. "
                        + "El enlace es válido por 30 minutos:</p>"
                        + "<p><a href=\"" + enlace + "\">Restablecer contraseña</a></p>"
                        + "<p>Si no fuiste tú, ignora este correo.</p>");
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
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
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
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject(usuario.getEmail())
                .claim(JwtClaims.TYPE, JwtClaims.TYPE_REFRESH)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + refreshExpiration))
                .signWith(key)
                .compact();
    }
}
