package com.novacrm.config.correo;

import com.novacrm.config.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Proveedor nulo de correo electrónico para entornos donde no se requiera o no se desee enviar mails.
 */
@Component
public class NoopProveedorCorreo implements ProveedorCorreo {

    private static final Logger log = LoggerFactory.getLogger(NoopProveedorCorreo.class);

    @Override
    public String nombre() {
        return "noop";
    }

    @Override
    public boolean estaConfigurado() {
        return false;
    }

    @Override
    public String canalActivo() {
        return "ninguno";
    }

    @Override
    public EmailService.Resultado enviar(String destinatario, String asunto, String htmlBody) {
        String motivo = "No hay canal de correo configurado. Define un servidor SMTP (spring.mail.*) o las credenciales de SES.";
        log.warn("No se envio el correo a {}: {}", destinatario, motivo);
        return EmailService.Resultado.fallo(motivo);
    }
}
