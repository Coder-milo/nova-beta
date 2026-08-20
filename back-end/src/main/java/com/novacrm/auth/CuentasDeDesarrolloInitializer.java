package com.novacrm.auth;

import com.novacrm.empresa.Empresa;
import com.novacrm.empresa.EmpresaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Set;

/**
 * Cuentas para probar el panel y el portal en local.
 *
 * <p><strong>Solo bajo el perfil {@code dev}.</strong> Es la unica salvaguarda
 * que de verdad importa aqui: una cuenta de prueba con permisos de coordinador
 * en produccion es una puerta trasera, y da igual lo buena que sea su
 * contrasena si esta escrita en el repositorio.
 *
 * <p>Por eso tampoco hay contrasena fija. Este proyecto ya tiene
 * {@link CredencialSembradaInitializer}, que existe precisamente para matar la
 * contrasena de ejemplo que {@code V1__init.sql} dejo sembrada; sembrar dos
 * cuentas nuevas con clave conocida deshace ese trabajo. Se genera una
 * aleatoria y se escribe <em>una vez</em> en el log de arranque, igual que hace
 * aquel. Si prefieres fijarla, define {@code DEV_SEED_PASSWORD}.
 *
 * <p>Es idempotente: si las cuentas ya existen no las toca, asi que reiniciar
 * el entorno no cambia contrasenas que ya estes usando.
 */
@Component
@Profile("dev")
@Order(10)
public class CuentasDeDesarrolloInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CuentasDeDesarrolloInitializer.class);

    private static final String CORREO_COORDINADOR = "coordinador@local.test";
    private static final String CORREO_EMPRESA = "empresa@local.test";

    /** Empresa ficticia a la que se ata la cuenta del portal. */
    private static final String EMPRESA_DEMO = "Empresa de Pruebas S.A.S.";

    private final UsuarioRepository usuarioRepository;
    private final EmpresaRepository empresaRepository;
    private final PasswordEncoder passwordEncoder;
    private final String contrasenaFijada;

    public CuentasDeDesarrolloInitializer(UsuarioRepository usuarioRepository,
                                          EmpresaRepository empresaRepository,
                                          PasswordEncoder passwordEncoder,
                                          @Value("${DEV_SEED_PASSWORD:}") String contrasenaFijada) {
        this.usuarioRepository = usuarioRepository;
        this.empresaRepository = empresaRepository;
        this.passwordEncoder = passwordEncoder;
        this.contrasenaFijada = contrasenaFijada;
    }

    @Override
    @Transactional
    public void run(String... args) {
        boolean faltaCoordinador = usuarioRepository.findByEmailIgnoreCase(CORREO_COORDINADOR).isEmpty();
        boolean faltaEmpresa = usuarioRepository.findByEmailIgnoreCase(CORREO_EMPRESA).isEmpty();

        if (!faltaCoordinador && !faltaEmpresa) {
            return;
        }

        boolean laDioElEntorno = contrasenaFijada != null && !contrasenaFijada.isBlank();
        String clave = laDioElEntorno ? contrasenaFijada : generar();
        String hash = passwordEncoder.encode(clave);

        if (faltaCoordinador) {
            var coordinador = new Usuario();
            coordinador.setEmail(CORREO_COORDINADOR);
            coordinador.setNombre("Coordinadora de pruebas");
            coordinador.setPassword(hash);
            coordinador.setRoles(Set.of(Rol.COORDINADOR));
            coordinador.setActivo(true);
            usuarioRepository.save(coordinador);
        }

        if (faltaEmpresa) {
            // La empresa tiene que existir antes que el rol: el disparador de
            // V54 rechaza una cuenta EMPRESA sin `empresa_id`.
            Empresa empresa = empresaRepository.findFirstByNombreIgnoreCaseAndActivoTrue(EMPRESA_DEMO)
                    .orElseGet(() -> {
                        var nueva = new Empresa();
                        nueva.setNombre(EMPRESA_DEMO);
                        nueva.setSector("Servicios");
                        nueva.setCiudad("Barranquilla");
                        nueva.setActivo(true);
                        return empresaRepository.save(nueva);
                    });

            var cuenta = new Usuario();
            cuenta.setEmail(CORREO_EMPRESA);
            cuenta.setNombre("Contacto de Empresa de Pruebas");
            cuenta.setPassword(hash);
            cuenta.setEmpresa(empresa);
            cuenta.setRoles(Set.of(Rol.EMPRESA));
            cuenta.setActivo(true);
            usuarioRepository.save(cuenta);
        }

        if (laDioElEntorno) {
            log.warn("Cuentas de desarrollo creadas ({} y {}) con DEV_SEED_PASSWORD.",
                    CORREO_COORDINADOR, CORREO_EMPRESA);
            return;
        }

        log.warn("""

                ==========================================================
                 CUENTAS DE DESARROLLO (perfil dev, esta base de datos)

                   Coordinador : {}
                   Empresa     : {}   -> {}

                   Contrasena para las dos:

                       {}

                 Se genera una vez. Si reinicias, estas cuentas ya existen
                 y la contrasena NO cambia. Para fijarla tu mismo, define
                 DEV_SEED_PASSWORD antes de arrancar.
                ==========================================================
                """, CORREO_COORDINADOR, CORREO_EMPRESA, EMPRESA_DEMO, clave);
    }

    private String generar() {
        byte[] bytes = new byte[18];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
