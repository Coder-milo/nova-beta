package com.novacrm.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Comprueba al arrancar que {@code app.frontend-url} apunta a algun sitio real.
 *
 * <p>De esa direccion cuelga el enlace de los correos que abren cuenta y de los
 * que recuperan contrasena: es lo unico que un estudiante puede pulsar para
 * entrar por primera vez. Su valor por defecto es {@code localhost:3000}, util
 * en desarrollo e inservible fuera de el.
 *
 * <p>Sin esta comprobacion el fallo es invisible desde dentro: el correo se
 * envia, el log dice que se envio, y son los 107 destinatarios los que
 * descubren que el enlace no lleva a ninguna parte. Nadie se entera hasta que
 * alguien avisa, y para entonces ya se mando.
 *
 * <p>Avisa, no tumba el arranque. Seria mas contundente hacerlo fallar como
 * {@code SecurityConfig} con {@code JWT_SECRET}, pero el {@code docker-compose}
 * de este repositorio levanta el perfil {@code prod} en local y con
 * {@code localhost} a proposito: fallar ahi rompe el entorno de desarrollo de
 * quien trabaja aqui, que es un precio alto por un aviso. El grito va con el
 * detalle de lo que se rompe, para que no se confunda con ruido de arranque.
 */
@Component
public class UrlDelFrontend {

    private static final Logger log = LoggerFactory.getLogger(UrlDelFrontend.class);

    private final Environment environment;

    @Value("${app.frontend-url:}")
    private String frontendUrl;

    public UrlDelFrontend(Environment environment) {
        this.environment = environment;
    }

    @jakarta.annotation.PostConstruct
    void validar() {
        if (!esLocal(frontendUrl)) {
            return;
        }
        if (environment.acceptsProfiles(org.springframework.core.env.Profiles.of("prod"))) {
            log.warn("""
                    FRONTEND_URL apunta a «{}». De ahi cuelga el enlace de los correos de \
                    activacion de cuenta y de recuperacion de contrasena: si esto no es una \
                    maquina de desarrollo, cada estudiante recibira un enlace que no lleva a \
                    ninguna parte, y el envio se dara por bueno igual. Define FRONTEND_URL con \
                    la direccion publica del frontend.""", frontendUrl);
            return;
        }
        log.info("app.frontend-url es «{}»: correcto en local, pero los enlaces de los correos "
                + "solo funcionan en esta maquina.", frontendUrl);
    }

    /** Si la direccion solo vale en la maquina donde corre la aplicacion. */
    static boolean esLocal(String url) {
        if (url == null || url.isBlank()) {
            return true;
        }
        String limpia = url.trim().toLowerCase(java.util.Locale.ROOT);
        return limpia.contains("localhost")
                || limpia.contains("127.0.0.1")
                || limpia.contains("://0.0.0.0")
                || limpia.startsWith("http://[::1]");
    }
}
