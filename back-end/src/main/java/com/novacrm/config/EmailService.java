package com.novacrm.config;

import com.novacrm.config.correo.ProveedorCorreo;
import org.springframework.stereotype.Service;

/**
 * Servicio Façade de Correo Electrónico. Delega las operaciones de envío
 * al {@link ProveedorCorreo} activo (SMTP, AWS SES, Noop).
 */
@Service
public class EmailService {

    private final ProveedorCorreo proveedorCorreo;

    public EmailService(ProveedorCorreo proveedorCorreo) {
        this.proveedorCorreo = proveedorCorreo;
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
     */
    public Resultado enviar(String to, String subject, String htmlBody) {
        return proveedorCorreo.enviar(to, subject, htmlBody);
    }
}
