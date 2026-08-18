package com.novacrm.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

/**
 * Impide que un despliegue quede accesible con la contrasena de ejemplo.
 *
 * <p>{@code V1__init.sql} siembra {@code admin@novacrm.com} con el hash de
 * {@code admin123}, y lo dice en un comentario del propio archivo. Esa
 * migracion ya se aplico en todas partes, asi que no se puede corregir donde
 * esta: cambiarle una sola letra altera su checksum y Flyway se niega a
 * arrancar. Lo que si se puede es asegurarse de que esa contrasena no siga
 * siendo valida en ningun entorno.
 *
 * <p>Solo actua sobre cuentas cuya contrasena <em>sigue siendo</em> la
 * sembrada. Quien ya la cambio —en esta base, el administrador real— no se ve
 * afectado, que es la razon por la que esto se comprueba contra el hash
 * guardado y no se reescribe la cuenta a ciegas.
 *
 * <p>La nueva contrasena sale de {@code ADMIN_INITIAL_PASSWORD} si esta
 * definida. Si no lo esta, se genera una aleatoria y se escribe una vez en el
 * log de arranque, que es la unica forma de no dejar fuera a quien acaba de
 * levantar el entorno. Es el mismo arranque que hacen Jenkins o Keycloak.
 * Anotarla y cambiarla desde la aplicacion es parte de poner en marcha un
 * despliegue nuevo.
 */
@Component
@Order(0)
public class CredencialSembradaInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CredencialSembradaInitializer.class);

    /**
     * El hash que siembra V1. Es publico —esta en el repositorio— y por eso
     * sirve como marca de "esta cuenta nunca se toco".
     */
    private static final String HASH_SEMBRADO =
            "$2a$10$.XT99VGrzqD16sUXmhyJ0OAmD3MxkJV7E77eiPoz31KY8AFUGjNTe";

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final String contrasenaInicial;

    public CredencialSembradaInitializer(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            @Value("${ADMIN_INITIAL_PASSWORD:}") String contrasenaInicial) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.contrasenaInicial = contrasenaInicial;
    }

    @Override
    @Transactional
    public void run(String... args) {
        List<Usuario> conLaSembrada = usuarioRepository.findAll().stream()
                .filter(u -> HASH_SEMBRADO.equals(u.getPassword()))
                .toList();

        if (conLaSembrada.isEmpty()) {
            return;
        }

        boolean laDioElEntorno = contrasenaInicial != null && !contrasenaInicial.isBlank();
        String nueva = laDioElEntorno ? contrasenaInicial : generarContrasena();

        for (Usuario u : conLaSembrada) {
            u.setPassword(passwordEncoder.encode(nueva));
            usuarioRepository.save(u);

            if (laDioElEntorno) {
                log.warn("La cuenta {} tenia la contrasena de ejemplo y se ha cambiado por "
                        + "ADMIN_INITIAL_PASSWORD.", u.getEmail());
            } else {
                // Se escribe una sola vez, en el arranque de un entorno nuevo.
                // Sin esto, cerrar la puerta dejaria fuera tambien a quien
                // acaba de desplegar.
                log.warn("""

                        ==========================================================
                         La cuenta {} tenia la contrasena de ejemplo del repositorio.
                         Se ha cambiado por una aleatoria para este entorno:

                             {}

                         Anotala, entra y cambiala desde la aplicacion.
                         Para fijarla tu mismo, define ADMIN_INITIAL_PASSWORD.
                        ==========================================================
                        """, u.getEmail(), nueva);
            }
        }
    }

    /** 24 bytes de {@link SecureRandom}, en base64 sin relleno. */
    private String generarContrasena() {
        byte[] bytes = new byte[24];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
