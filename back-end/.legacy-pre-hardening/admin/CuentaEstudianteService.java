package com.novacrm.admin;

import com.novacrm.auth.Rol;
import com.novacrm.auth.Usuario;
import com.novacrm.auth.UsuarioRepository;
import com.novacrm.config.EmailService;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class CuentaEstudianteService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final EstudianteRepository estudianteRepository;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${app.correo.destinatarios-permitidos:${CORREO_DESTINATARIOS_PERMITIDOS:}}")
    private String destinatariosPermitidosRaw;

    public CuentaEstudianteService(
            EstudianteRepository estudianteRepository,
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            EmailService emailService) {
        this.estudianteRepository = estudianteRepository;
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
    }

    public PadronResponse padron() {
        List<Estudiante> estudiantes = estudiantesActivos();
        Set<String> cuentas = emailsDeUsuarios();
        Set<String> permitidos = destinatariosPermitidos();

        List<FilaPadronResponse> filas = estudiantes.stream()
                .map(estudiante -> {
                    String email = limpiarEmail(estudiante.getEmail());
                    return new FilaPadronResponse(
                            estudiante.getId(),
                            nombreCompleto(estudiante),
                            email,
                            email != null && cuentas.contains(normalizarEmail(email)),
                            email != null && (permitidos.isEmpty()
                                    || permitidos.contains(normalizarEmail(email))));
                })
                .toList();

        long conCuenta = filas.stream().filter(FilaPadronResponse::tieneCuenta).count();
        long sinCorreo = filas.stream().filter(fila -> fila.email() == null).count();
        return new PadronResponse(
                filas.size(),
                conCuenta,
                filas.size() - conCuenta - sinCorreo,
                sinCorreo,
                new ArrayList<>(permitidos),
                canalDeCorreo(),
                filas);
    }

    @Transactional
    public ResumenAltaResponse crear(CrearCuentasRequest request) {
        boolean simulacion = request == null || request.simulacion();
        boolean enviarCorreo = request != null && request.enviarCorreo();
        Set<UUID> seleccion = request == null || request.estudianteIds() == null
                ? Set.of()
                : new LinkedHashSet<>(request.estudianteIds());

        List<Estudiante> candidatos = estudiantesActivos().stream()
                .filter(estudiante -> seleccion.isEmpty() || seleccion.contains(estudiante.getId()))
                .toList();
        Set<String> cuentas = emailsDeUsuarios();
        Set<String> permitidos = destinatariosPermitidos();
        List<ResultadoCuentaResponse> detalle = new ArrayList<>();

        int creadas = 0;
        int yaTenian = 0;
        int sinCorreo = 0;
        int correosEnviados = 0;
        int correosFallidos = 0;

        for (Estudiante estudiante : candidatos) {
            String email = limpiarEmail(estudiante.getEmail());
            String nombre = nombreCompleto(estudiante);

            if (email == null) {
                sinCorreo++;
                detalle.add(new ResultadoCuentaResponse(
                        estudiante.getId(), nombre, null, "SIN_CORREO",
                        "SIN_DIRECCION", false, "La ficha no tiene correo."));
                continue;
            }

            String emailNormalizado = normalizarEmail(email);
            if (cuentas.contains(emailNormalizado)) {
                yaTenian++;
                detalle.add(new ResultadoCuentaResponse(
                        estudiante.getId(), nombre, email, "YA_TENIA",
                        "NO_SOLICITADO", false, "El estudiante ya tiene cuenta."));
                continue;
            }

            creadas++;
            String token = nuevoToken();
            if (!simulacion) {
                Usuario usuario = new Usuario();
                usuario.setEmail(emailNormalizado);
                usuario.setNombre(nombre);
                usuario.setPassword(passwordEncoder.encode(nuevoToken()));
                usuario.setRoles(Set.of(Rol.ESTUDIANTE));
                usuario.setActivo(true);
                usuario.setResetToken(token);
                usuario.setResetTokenExpira(LocalDateTime.now().plusHours(24));
                usuarioRepository.save(usuario);
                cuentas.add(emailNormalizado);
            }

            String envio = "NO_SOLICITADO";
            String mensaje = simulacion ? "Se crearía la cuenta." : "Cuenta creada.";
            boolean correoEnviado = false;

            if (enviarCorreo) {
                if (!permitidos.isEmpty() && !permitidos.contains(emailNormalizado)) {
                    envio = "BLOQUEADO_POR_LISTA";
                    mensaje = "Cuenta creada; correo omitido por la lista de pruebas.";
                } else if (simulacion) {
                    mensaje = "Se crearía la cuenta y se enviaría el enlace.";
                } else {
                    try {
                        String enlace = frontendUrl + "/recuperar-contrasena?token=" + token;
                        emailService.enviar(
                                emailNormalizado,
                                "Activa tu cuenta — NOVA CRM",
                                "<p>Se creó tu cuenta en NOVA CRM.</p>"
                                        + "<p><a href=\"" + enlace
                                        + "\">Define tu contraseña</a></p>");
                        envio = "ENVIADO";
                        correoEnviado = true;
                        correosEnviados++;
                        mensaje = "Cuenta creada y enlace enviado.";
                    } catch (RuntimeException ex) {
                        envio = "FALLIDO";
                        correosFallidos++;
                        mensaje = "Cuenta creada, pero no se pudo enviar el correo.";
                    }
                }
            }

            detalle.add(new ResultadoCuentaResponse(
                    estudiante.getId(), nombre, emailNormalizado, "CREADA",
                    envio, correoEnviado, mensaje));
        }

        return new ResumenAltaResponse(
                creadas, yaTenian, sinCorreo, correosEnviados, correosFallidos,
                simulacion, canalDeCorreo(), detalle);
    }

    private List<Estudiante> estudiantesActivos() {
        return estudianteRepository.findAll().stream()
                .filter(Estudiante::isActivo)
                .sorted(java.util.Comparator.comparing(
                        CuentaEstudianteService::nombreCompleto,
                        String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private Set<String> emailsDeUsuarios() {
        return usuarioRepository.findAll().stream()
                .map(Usuario::getEmail)
                .map(CuentaEstudianteService::normalizarEmail)
                .collect(Collectors.toSet());
    }

    private Set<String> destinatariosPermitidos() {
        if (destinatariosPermitidosRaw == null || destinatariosPermitidosRaw.isBlank()) {
            return Set.of();
        }
        return List.of(destinatariosPermitidosRaw.split(",")).stream()
                .map(CuentaEstudianteService::normalizarEmail)
                .filter(email -> !email.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private String canalDeCorreo() {
        return "SES";
    }

    private static String nombreCompleto(Estudiante estudiante) {
        return (estudiante.getNombre() + " " + estudiante.getApellido()).trim();
    }

    private static String limpiarEmail(String email) {
        return email == null || email.isBlank() ? null : email.trim();
    }

    private static String normalizarEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static String nuevoToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    public record FilaPadronResponse(
            UUID estudianteId,
            String nombre,
            String email,
            boolean tieneCuenta,
            boolean sePuedeEscribir) {
    }

    public record PadronResponse(
            long total,
            long conCuenta,
            long sinCuenta,
            long sinCorreo,
            List<String> destinatariosPermitidos,
            String canalDeCorreo,
            List<FilaPadronResponse> estudiantes) {
    }

    public record CrearCuentasRequest(
            List<UUID> estudianteIds,
            boolean enviarCorreo,
            boolean simulacion) {
    }

    public record ResultadoCuentaResponse(
            UUID estudianteId,
            String nombre,
            String email,
            String estado,
            String envio,
            boolean correoEnviado,
            String detalle) {
    }

    public record ResumenAltaResponse(
            int creadas,
            int yaTenian,
            int sinCorreo,
            int correosEnviados,
            int correosFallidos,
            boolean simulacion,
            String canalDeCorreo,
            List<ResultadoCuentaResponse> detalle) {
    }
}
