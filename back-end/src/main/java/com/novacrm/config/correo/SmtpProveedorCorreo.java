package com.novacrm.config.correo;

import com.novacrm.config.CorreoSmtpSender;
import com.novacrm.config.EmailService;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Implementación de {@link ProveedorCorreo} que utiliza un servidor SMTP.
 */
@Component
public class SmtpProveedorCorreo implements ProveedorCorreo {

    private final Optional<CorreoSmtpSender> sender;

    public SmtpProveedorCorreo(Optional<CorreoSmtpSender> sender) {
        this.sender = sender;
    }

    @Override
    public String nombre() {
        return "smtp";
    }

    @Override
    public boolean estaConfigurado() {
        return sender.map(CorreoSmtpSender::estaConfigurado).orElse(false);
    }

    @Override
    public String canalActivo() {
        return "SMTP";
    }

    @Override
    public EmailService.Resultado enviar(String destinatario, String asunto, String htmlBody) {
        if (!estaConfigurado() || sender.isEmpty()) {
            return EmailService.Resultado.fallo("Canal SMTP no configurado o no disponible.");
        }
        return sender.get().enviar(destinatario, asunto, htmlBody);
    }
}
