package com.novacrm.config;

import com.novacrm.config.correo.ProveedorCorreo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Servicio Façade de Correo Electrónico. Delega las operaciones de envío
 * al {@link ProveedorCorreo} activo (SMTP, AWS SES, Noop).
 *
 * <p>Aquí se aplica también {@link DestinatariosPermitidos}, y no en cada
 * servicio que envía. Su propio javadoc pedía vivir en un solo sitio —«dos
 * copias de esa comprobación son dos sitios donde puede quedar mal»— y estaba
 * en dos servicios y faltando en un tercero: el correo de recuperación de
 * contraseña salía sin pasar por ella. Todo el correo del sistema cruza esta
 * puerta, así que aquí no se puede olvidar.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final ProveedorCorreo proveedorCorreo;
    private final DestinatariosPermitidos destinatariosPermitidos;

    public EmailService(ProveedorCorreo proveedorCorreo,
                        DestinatariosPermitidos destinatariosPermitidos) {
        this.proveedorCorreo = proveedorCorreo;
        this.destinatariosPermitidos = destinatariosPermitidos;
    }

    /** Resultado de un envío. */
    public record Resultado(boolean enviado, String motivoFallo) {
        public static Resultado ok() {
            return new Resultado(true, null);
        }

        public static Resultado fallo(String motivo) {
            return new Resultado(false, motivo);
        }
    }

    /** Si hay algún canal capaz de enviar. */
    public boolean estaConfigurado() {
        return proveedorCorreo.estaConfigurado();
    }

    /** Qué canal se usaría ahora mismo. Útil para diagnosticar. */
    public String canalActivo() {
        return proveedorCorreo.canalActivo();
    }

    /**
     * Envía un correo y devuelve si lo consiguió.
     *
     * <p>Con {@code app.correo.destinatarios-permitidos} configurada, a nadie
     * fuera de esa lista se le escribe. En producción la lista está vacía y
     * esto no hace nada; en un entorno de pruebas con datos copiados es lo
     * único que impide que una prueba le escriba a una persona real.
     */
    public Resultado enviar(String to, String subject, String htmlBody) {
        if (destinatariosPermitidos.hayRestriccion() && !destinatariosPermitidos.permite(to)) {
            log.info("Correo a {} omitido: no está en app.correo.destinatarios-permitidos", to);
            return Resultado.fallo("Destinatario fuera de la lista de pruebas permitida");
        }
        return proveedorCorreo.enviar(to, subject, htmlBody);
    }
}
