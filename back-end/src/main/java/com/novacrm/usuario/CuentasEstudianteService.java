package com.novacrm.usuario;

import com.novacrm.auth.Rol;
import com.novacrm.auth.Usuario;
import com.novacrm.auth.UsuarioRepository;
import com.novacrm.branding.BrandingService;
import com.novacrm.config.DestinatariosPermitidos;
import com.novacrm.config.EmailService;
import com.novacrm.config.MarcaCorreo;
import com.novacrm.config.PlantillaCorreo;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Alta de cuentas de acceso para los estudiantes.
 *
 * <p>La cuenta se crea con una contrasena aleatoria que <strong>nadie llega a
 * conocer</strong>: al estudiante se le manda un enlace de activacion para que
 * elija la suya. Enviar la contrasena por correo la dejaba escrita para siempre
 * en su bandeja de entrada y a la vista de quien la generase.
 *
 * <p>El vinculo entre estudiante y usuario es el correo: es lo que compara
 * {@code OwnershipService} para decidir a que ficha puede acceder quien inicia
 * sesion.
 */
@Service
public class CuentasEstudianteService {

    private static final Logger log = LoggerFactory.getLogger(CuentasEstudianteService.class);

    private static final SecureRandom RANDOM = new SecureRandom();

    /** Margen amplio: el estudiante puede tardar dias en abrir el correo. */
    private static final int DIAS_VIGENCIA_ACTIVACION = 7;

    private final EstudianteRepository estudianteRepository;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final BrandingService brandingService;
    /** La salvaguarda vive en un componente propio: es la unica cosa que
     *  separa una prueba de un envio a 108 personas reales, y dos copias de
     *  esa comprobacion son dos sitios donde puede quedar mal. */
    private final DestinatariosPermitidos destinatarios;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${app.correo.logo-url:}")
    private String logoUrl;

    @Value("${app.correo.banner-pie-url:}")
    private String bannerPieUrl;


    public CuentasEstudianteService(EstudianteRepository estudianteRepository,
                                    UsuarioRepository usuarioRepository,
                                    PasswordEncoder passwordEncoder,
                                    EmailService emailService,
                                    BrandingService brandingService,
                                    DestinatariosPermitidos destinatarios) {
        this.estudianteRepository = estudianteRepository;
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
        this.brandingService = brandingService;
        this.destinatarios = destinatarios;
    }

    /**
     * Que paso con la <strong>cuenta</strong>. Deliberadamente no incluye nada
     * sobre el correo: son dos cosas independientes y mezclarlas hacia perder
     * informacion. Cuando el envio fallaba, el estado pasaba a CORREO_FALLIDO y
     * el recuento de creadas caia a cero, aunque la cuenta si estuviera creada
     * y guardada. Con el SMTP mal configurado eso significaba dar de alta a los
     * 107 estudiantes y anunciar en pantalla que no se habia creado ninguna.
     */
    public enum Estado { CREADA, YA_TENIA, SIN_CORREO }

    /** Que paso con el correo, que es una pregunta aparte. */
    public enum EnvioCorreo {
        ENVIADO,
        /** No se pidio enviarlo. */
        NO_SOLICITADO,
        /** La direccion no esta en app.correo.destinatarios-permitidos. */
        BLOQUEADO_POR_LISTA,
        /** El proveedor rechazo el envio; el motivo va en el detalle. */
        FALLIDO,
        /** La ficha no tiene correo, asi que no habia a donde escribir. */
        SIN_DIRECCION
    }

    public record ResultadoCuenta(
            UUID estudianteId,
            String nombre,
            String email,
            Estado estado,
            EnvioCorreo envio,
            String detalle) {

        public boolean correoEnviado() {
            return envio == EnvioCorreo.ENVIADO;
        }
    }

    public record ResumenAlta(
            int creadas,
            int yaTenian,
            int sinCorreo,
            int correosEnviados,
            int correosFallidos,
            boolean simulacion,
            String canalDeCorreo,
            List<ResultadoCuenta> detalle) {}

    /** Un estudiante y si ya puede entrar al panel. */
    public record FilaPadron(
            UUID estudianteId,
            String nombre,
            String email,
            boolean tieneCuenta,
            /** Si el servidor tiene lista de pruebas, a quien se le puede escribir. */
            boolean sePuedeEscribir) {}

    public record Padron(
            int total,
            int conCuenta,
            int sinCuenta,
            int sinCorreo,
            /** Vacia = se escribe a todos. Con valores = solo a esos. */
            List<String> destinatariosPermitidos,
            String canalDeCorreo,
            List<FilaPadron> estudiantes) {}

    /**
     * Quien tiene cuenta y quien no. Solo lee.
     *
     * <p>Alimenta la pantalla desde la que se elige a quien escribirle: sin
     * esto la unica forma de saber a quien le falta cuenta era lanzar una
     * simulacion del alta, que es una peticion de escritura que no escribe
     * —algo que funciona pero que no conviene tener de por medio cuando el
     * accidente que se quiere evitar es crear 107 cuentas sin querer.
     */
    @Transactional(readOnly = true)
    public Padron padron() {
        var estudiantes = estudianteRepository.findAllByActivoTrue();

        var filas = estudiantes.stream().map(e -> {
            String email = e.getEmail() == null ? null : e.getEmail().trim();
            boolean sinCorreo = email == null || email.isBlank();
            return new FilaPadron(
                    e.getId(),
                    nombreCompleto(e),
                    sinCorreo ? null : email,
                    !sinCorreo && usuarioRepository.findByEmail(email).isPresent(),
                    !sinCorreo && destinatarioPermitido(email));
        }).toList();

        return new Padron(
                filas.size(),
                (int) filas.stream().filter(FilaPadron::tieneCuenta).count(),
                (int) filas.stream().filter(f -> f.email() != null && !f.tieneCuenta()).count(),
                (int) filas.stream().filter(f -> f.email() == null).count(),
                listaDeDestinatarios(),
                emailService.canalActivo(),
                filas);
    }

    /**
     * Crea las cuentas que falten para los estudiantes indicados.
     *
     * @param estudianteIds ids concretos; si viene vacio, todos los activos
     * @param enviarCorreo  si se envia a cada uno su enlace de activacion
     * @param simulacion    no crea ni envia nada; solo informa que haria
     */
    @Transactional
    public ResumenAlta crearCuentas(List<UUID> estudianteIds, boolean enviarCorreo, boolean simulacion) {
        List<Estudiante> estudiantes = (estudianteIds == null || estudianteIds.isEmpty())
                ? estudianteRepository.findAllByActivoTrue()
                : estudianteRepository.findAllById(estudianteIds);

        if (estudiantes.isEmpty()) {
            throw new BusinessException("No hay estudiantes para los que crear cuentas");
        }

        var resultados = new ArrayList<ResultadoCuenta>();
        for (Estudiante estudiante : estudiantes) {
            resultados.add(procesar(estudiante, enviarCorreo, simulacion));
        }

        return new ResumenAlta(
                contar(resultados, Estado.CREADA),
                contar(resultados, Estado.YA_TENIA),
                contar(resultados, Estado.SIN_CORREO),
                contarEnvios(resultados, EnvioCorreo.ENVIADO),
                contarEnvios(resultados, EnvioCorreo.FALLIDO),
                simulacion,
                emailService.canalActivo(),
                resultados);
    }

    private ResultadoCuenta procesar(Estudiante estudiante, boolean enviarCorreo, boolean simulacion) {
        String nombre = nombreCompleto(estudiante);
        String email = estudiante.getEmail() == null ? null : estudiante.getEmail().trim();

        if (email == null || email.isBlank()) {
            return new ResultadoCuenta(estudiante.getId(), nombre, null, Estado.SIN_CORREO,
                    EnvioCorreo.SIN_DIRECCION, "La ficha no tiene correo registrado");
        }

        var existente = usuarioRepository.findByEmail(email);

        if (simulacion) {
            return existente.isPresent()
                    ? new ResultadoCuenta(estudiante.getId(), nombre, email, Estado.YA_TENIA,
                            EnvioCorreo.NO_SOLICITADO, "Ya tiene cuenta de acceso")
                    : new ResultadoCuenta(estudiante.getId(), nombre, email, Estado.CREADA,
                            EnvioCorreo.NO_SOLICITADO,
                            "Simulacion: no se creo la cuenta ni se envio el correo");
        }

        Usuario usuario;
        Estado estado;
        if (existente.isPresent()) {
            usuario = existente.get();
            estado = Estado.YA_TENIA;
        } else {
            usuario = new Usuario();
            usuario.setEmail(email);
            usuario.setNombre(nombre);
            // Contrasena aleatoria que no se comunica a nadie: la cuenta queda
            // inutilizable hasta que el estudiante define la suya por el enlace.
            usuario.setPassword(passwordEncoder.encode(passwordInutilizable()));
            usuario.setRoles(Set.of(Rol.ESTUDIANTE));
            usuario.setActivo(true);
            estado = Estado.CREADA;
        }

        if (!enviarCorreo) {
            usuarioRepository.save(usuario);
            return new ResultadoCuenta(estudiante.getId(), nombre, email, estado,
                    EnvioCorreo.NO_SOLICITADO, estado == Estado.CREADA
                            ? "Cuenta creada; falta enviarle el enlace de activacion"
                            : "Ya tenia cuenta; no se envio nada");
        }

        if (!destinatarioPermitido(email)) {
            usuarioRepository.save(usuario);
            return new ResultadoCuenta(estudiante.getId(), nombre, email, estado,
                    EnvioCorreo.BLOQUEADO_POR_LISTA,
                    "Cuenta lista; correo no enviado: la direccion no esta en la lista de pruebas");
        }

        // El token se genera aqui y no antes para que solo exista si de verdad
        // se va a enviar: un token emitido y no comunicado es una credencial
        // viva que nadie va a usar.
        String token = generarTokenActivacion();
        usuario.setResetToken(token);
        usuario.setResetTokenExpira(LocalDateTime.now().plusDays(DIAS_VIGENCIA_ACTIVACION));
        usuarioRepository.save(usuario);

        var envio = emailService.enviar(email,
                "Activa tu acceso al panel - Cuando sabes ingles se nota",
                correoDeActivacion(nombre, email, token, marcaPara(estudiante)));

        if (envio.enviado()) {
            return new ResultadoCuenta(estudiante.getId(), nombre, email, estado,
                    EnvioCorreo.ENVIADO, "Enlace de activacion enviado");
        }

        // El estado de la cuenta se conserva: fallar el correo no deshace el
        // alta, y decir lo contrario haria repetir un trabajo ya hecho.
        log.warn("Cuenta lista para {} pero el correo fallo: {}", email, envio.motivoFallo());
        return new ResultadoCuenta(estudiante.getId(), nombre, email, estado,
                EnvioCorreo.FALLIDO, "Cuenta lista, pero el correo fallo: " + envio.motivoFallo());
    }

    /** Contrasena que nadie conoce: bloquea la cuenta hasta la activacion. */
    private static String passwordInutilizable() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private static String generarTokenActivacion() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    /**
     * Cuando hay lista de direcciones permitidas, solo se escribe a esas. Es lo
     * que evita que una prueba termine escribiendo a los 107 participantes.
     */
    boolean destinatarioPermitido(String email) {
        return destinatarios.permite(email);
    }

    private List<String> listaDeDestinatarios() {
        return destinatarios.lista();
    }

    /**
     * La marca con la que sale el correo de un estudiante.
     *
     * <p>Manda la de su programa; lo que ese programa no haya configurado se
     * rellena con la global. Asi un programa a medio personalizar no deja al
     * estudiante con un correo desnudo, y no hace falta duplicar la
     * configuracion institucional en cada uno.
     */
    MarcaCorreo marcaPara(Estudiante estudiante) {
        UUID programaId = estudiante.getPrograma() == null ? null : estudiante.getPrograma().getId();
        return brandingService.paraCorreo(programaId)
                .map(b -> new MarcaCorreo(
                        primeroNoVacio(b.getCorreoHeaderUrl(), logoUrl),
                        b.getCorreoHeaderAncho(),
                        b.getCorreoHeaderAlto(),
                        primeroNoVacio(b.getCorreoPieUrl(), bannerPieUrl),
                        b.getCorreoPieAncho(),
                        b.getCorreoPieAlto(),
                        b.getCorreoTextoPie(),
                        b.getColorPrimario()))
                .orElseGet(() -> MarcaCorreo.global(logoUrl, bannerPieUrl));
    }

    private static String primeroNoVacio(String preferido, String respaldo) {
        return preferido == null || preferido.isBlank() ? respaldo : preferido;
    }

    String correoDeActivacion(String nombre, String email, String token) {
        return correoDeActivacion(nombre, email, token, MarcaCorreo.global(logoUrl, bannerPieUrl));
    }

    /**
     * El cuerpo vive en {@link com.novacrm.correo.CorreosDelSistema} para que la
     * previsualización del panel enseñe este mismo HTML y no una copia que se
     * desactualice.
     */
    String correoDeActivacion(String nombre, String email, String token, MarcaCorreo marca) {
        String enlace = frontendUrl + "/recuperar-contrasena?token=" + token;
        return com.novacrm.correo.CorreosDelSistema.activacion(
                nombre, email, enlace, DIAS_VIGENCIA_ACTIVACION, marca);
    }

    private static int contar(List<ResultadoCuenta> resultados, Estado estado) {
        return (int) resultados.stream().filter(r -> r.estado() == estado).count();
    }

    private static int contarEnvios(List<ResultadoCuenta> resultados, EnvioCorreo envio) {
        return (int) resultados.stream().filter(r -> r.envio() == envio).count();
    }

    private static String nombreCompleto(Estudiante estudiante) {
        String nombre = estudiante.getNombre() == null ? "" : estudiante.getNombre();
        String apellido = estudiante.getApellido() == null ? "" : estudiante.getApellido();
        String completo = (nombre + " " + apellido).trim();
        return completo.isEmpty() ? "Estudiante" : completo;
    }
}
