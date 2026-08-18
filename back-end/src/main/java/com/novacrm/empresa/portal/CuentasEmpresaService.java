package com.novacrm.empresa.portal;

import com.novacrm.auth.Rol;
import com.novacrm.auth.Usuario;
import com.novacrm.auth.UsuarioRepository;
import com.novacrm.config.EmailService;
import com.novacrm.empresa.Empresa;
import com.novacrm.empresa.EmpresaRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;

/**
 * Alta de cuentas del portal de empresas.
 *
 * <p><strong>Por invitacion, nunca por registro abierto.</strong> Un formulario
 * publico de «crea tu cuenta de empresa» significa que cualquiera que escriba
 * un nombre plausible entra a ver postulantes: el registro abierto solo sirve
 * cuando lo que hay detras es del propio usuario, y aqui lo que hay detras son
 * datos de terceros. El equipo da de alta la empresa, y desde ahi invita a la
 * persona de contacto.
 *
 * <p>La cuenta nace bloqueada —contrasena aleatoria que nadie conoce— y se
 * activa con el mismo enlace de un solo uso que ya usan los estudiantes. Se
 * reutiliza ese circuito a proposito: es el que esta probado y el que expira.
 */
@Service
public class CuentasEmpresaService {

    private static final Logger log = LoggerFactory.getLogger(CuentasEmpresaService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * Vigencia del enlace de activacion.
     *
     * <p>Mas corta que la de los estudiantes: quien recibe esto es un tercero,
     * y un enlace que abre un portal con datos de personas no puede quedarse
     * vivo una semana en una bandeja de entrada corporativa compartida.
     */
    private static final int DIAS_VIGENCIA = 3;

    private final EmpresaRepository empresaRepository;
    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    public CuentasEmpresaService(EmpresaRepository empresaRepository,
                                 UsuarioRepository usuarioRepository,
                                 PasswordEncoder passwordEncoder,
                                 EmailService emailService) {
        this.empresaRepository = empresaRepository;
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
    }

    public record ResultadoInvitacion(
            UUID usuarioId,
            String email,
            String empresaNombre,
            boolean correoEnviado,
            String detalle) {}

    /**
     * Invita a una persona de contacto de una empresa aliada.
     *
     * @param empresaId a que empresa queda atada la cuenta
     * @param email     direccion de quien va a entrar
     * @param nombre    como se llama, para el saludo del correo
     */
    @Transactional
    public ResultadoInvitacion invitar(UUID empresaId, String email, String nombre) {
        Empresa empresa = empresaRepository.findById(empresaId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));

        if (!empresa.isActivo()) {
            throw new BusinessException("La empresa esta inactiva; reactivala antes de invitar");
        }

        String correo = email == null ? "" : email.trim().toLowerCase();
        if (correo.isEmpty() || !correo.contains("@")) {
            throw new BusinessException("Hace falta un correo valido para invitar");
        }

        // Una direccion no puede pertenecer a dos empresas ni ser a la vez
        // cuenta del programa y del portal: el rol decide que ve, y una cuenta
        // con los dos roles veria el censo completo desde el portal externo.
        var existente = usuarioRepository.findByEmailIgnoreCase(correo);
        if (existente.isPresent()) {
            Usuario u = existente.get();
            boolean esDeOtraEmpresa = u.getEmpresa() != null && !empresaId.equals(u.getEmpresa().getId());
            boolean esDelPrograma = u.getRoles() != null
                    && (u.getRoles().contains(Rol.ADMIN)
                        || u.getRoles().contains(Rol.COORDINADOR)
                        || u.getRoles().contains(Rol.ESTUDIANTE));
            if (esDeOtraEmpresa) {
                throw new BusinessException("Ese correo ya pertenece a otra empresa");
            }
            if (esDelPrograma) {
                throw new BusinessException(
                        "Ese correo ya es una cuenta del programa; usa una direccion distinta para el portal");
            }
        }

        Usuario usuario = existente.orElseGet(Usuario::new);
        // Nueva es la que no vino de la base, no la que no tiene identificador.
        //
        // `BaseEntity` inicializa el id con `UUID.randomUUID()` en la propia
        // declaracion del campo, asi que un `new Usuario()` ya trae uno puesto:
        // preguntar por `getId() == null` daba siempre falso, no se llegaba a
        // poner el correo ni la contrasena, y la invitacion moria contra el
        // NOT NULL de `usuario.email`. Es decir, invitar a una empresa no
        // funciono nunca desde que se escribio.
        boolean esNueva = existente.isEmpty();
        if (esNueva) {
            usuario.setEmail(correo);
            usuario.setNombre(nombre == null || nombre.isBlank() ? correo : nombre.trim());
            usuario.setPassword(passwordEncoder.encode(aleatorio()));
            usuario.setActivo(true);
        }
        // El orden importa: la empresa se asigna antes que el rol porque el
        // disparador de V54 rechaza un rol EMPRESA sobre un usuario sin
        // empresa. JPA inserta la fila de usuario —con `empresa_id`— antes que
        // las de `usuario_rol`, asi que la comprobacion la encuentra puesta.
        usuario.setEmpresa(empresa);
        usuario.setRoles(Set.of(Rol.EMPRESA));

        String token = aleatorio();
        usuario.setResetToken(token);
        usuario.setResetTokenExpira(LocalDateTime.now().plusDays(DIAS_VIGENCIA));
        Usuario guardado = usuarioRepository.save(usuario);

        var envio = emailService.enviar(correo,
                "Acceso al portal de empresas - CAC Academic",
                cuerpoDeInvitacion(usuario.getNombre(), empresa.getNombre(), token));

        if (!envio.enviado()) {
            // El alta no se deshace: la cuenta esta bien creada y reintentar la
            // invitacion es barato. Decir que fallo todo obligaria a repetir un
            // trabajo que ya esta hecho.
            log.warn("Cuenta de empresa creada para {} pero el correo fallo: {}",
                    correo, envio.motivoFallo());
            return new ResultadoInvitacion(guardado.getId(), correo, empresa.getNombre(), false,
                    "Cuenta lista, pero el correo fallo: " + envio.motivoFallo());
        }

        return new ResultadoInvitacion(guardado.getId(), correo, empresa.getNombre(), true,
                esNueva ? "Invitacion enviada" : "Invitacion reenviada");
    }

    /** Revoca el acceso sin borrar la cuenta, para no perder el rastro de auditoria. */
    @Transactional
    public void revocar(UUID usuarioId) {
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new ResourceNotFoundException("Cuenta no encontrada"));
        if (usuario.getRoles() == null || !usuario.getRoles().contains(Rol.EMPRESA)) {
            throw new BusinessException("Esa cuenta no es del portal de empresas");
        }
        usuario.setActivo(false);
        usuario.setResetToken(null);
        usuario.setResetTokenExpira(null);
        // `credencialesDesde` corta las sesiones abiertas: sin esto, revocar no
        // echa a quien ya tenia el portal abierto hasta que caduque su refresh.
        usuario.setCredencialesDesde(LocalDateTime.now());
        usuarioRepository.save(usuario);
    }

    private static String aleatorio() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private String cuerpoDeInvitacion(String nombre, String empresa, String token) {
        String enlace = frontendUrl + "/recuperar-contrasena?token=" + token;
        return """
                <p>Hola %s,</p>
                <p>Te damos acceso al portal de empresas de CAC Academic en nombre de <strong>%s</strong>.
                Desde ahi puedes publicar vacantes y revisar a quienes se postulan a ellas.</p>
                <p><a href="%s">Define tu contrase&ntilde;a y entra</a></p>
                <p>El enlace caduca en %d d&iacute;as y solo sirve una vez.</p>
                """.formatted(nombre, empresa, enlace, DIAS_VIGENCIA);
    }

    /** Una cuenta del portal, como se ve desde la ficha de la empresa. */
    public record CuentaDelPortal(
            UUID id,
            String email,
            String nombre,
            boolean activa,
            /** Invitada y todavia sin entrar: el enlace sigue vivo. */
            boolean invitacionPendiente) {}

    /**
     * Quien puede entrar al portal en nombre de esta empresa.
     *
     * <p>Devuelve tambien las revocadas, marcadas. Ocultarlas llevaba a invitar
     * otra vez el mismo correo y chocar con un error que no explica nada desde
     * la ficha.
     */
    @Transactional(readOnly = true)
    public java.util.List<CuentaDelPortal> cuentasDe(UUID empresaId) {
        return usuarioRepository.findByEmpresaIdOrderByEmailAsc(empresaId).stream()
                .filter(u -> u.getRoles() != null && u.getRoles().contains(Rol.EMPRESA))
                .map(u -> new CuentaDelPortal(
                        u.getId(), u.getEmail(), u.getNombre(), u.isActivo(),
                        u.getResetToken() != null
                                && u.getResetTokenExpira() != null
                                && u.getResetTokenExpira().isAfter(LocalDateTime.now())))
                .toList();
    }

}
