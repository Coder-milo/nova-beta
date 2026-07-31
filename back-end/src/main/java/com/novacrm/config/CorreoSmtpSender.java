package com.novacrm.config;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Envio de correo por SMTP.
 *
 * <p>Se usa SMTP y no la API propia de un proveedor concreto para no quedar
 * atados a ninguno: la misma configuracion sirve para Brevo, Resend, Mailgun o
 * el servidor de correo de la institucion. Cambiar de proveedor es cambiar
 * cuatro propiedades, no reescribir codigo.
 *
 * <p>Solo se activa si hay un servidor configurado
 * ({@code spring.mail.host}); si no, queda el envio por SES.
 */
@Component
@ConditionalOnProperty(name = "spring.mail.host")
public class CorreoSmtpSender {

    private static final Logger log = LoggerFactory.getLogger(CorreoSmtpSender.class);

    private final JavaMailSender mailSender;

    @Value("${app.correo.remitente:}")
    private String remitente;

    @Value("${app.correo.nombre-remitente:NOVA - CAC Eurocentres}")
    private String nombreRemitente;

    @Value("${spring.mail.host:}")
    private String host;

    public CorreoSmtpSender(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    /**
     * Exige servidor y remitente. La propiedad puede existir con valor vacio
     * —asi queda declarada por defecto—, y en ese caso intentar enviar daria un
     * error de conexion confuso en lugar de decir que falta configurarlo.
     */
    public boolean estaConfigurado() {
        return host != null && !host.isBlank()
                && remitente != null && !remitente.isBlank();
    }

    public String descripcion() {
        return "SMTP";
    }

    public EmailService.Resultado enviar(String destinatario, String asunto, String htmlBody) {
        if (!estaConfigurado()) {
            return EmailService.Resultado.fallo(
                    "Falta app.correo.remitente: el proveedor exige un remitente verificado");
        }
        try {
            MimeMessage mensaje = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(mensaje, true, StandardCharsets.UTF_8.name());
            helper.setFrom(remitente, nombreRemitente);
            helper.setTo(destinatario);
            helper.setSubject(asunto);
            // Las dos versiones (multipart/alternative). Mandar solo HTML
            // penaliza en los filtros antispam, y en un envio masivo de
            // enlaces de activacion caer en spam es no haber enviado nada.
            helper.setText(TextoPlano.deHtml(htmlBody), htmlBody);

            mailSender.send(mensaje);
            log.info("Correo enviado por SMTP a {}", destinatario);
            return EmailService.Resultado.ok();

        } catch (Exception e) {
            // El mensaje del proveedor suele ser lo unico que explica el fallo
            // (remitente sin verificar, credenciales, cuota agotada).
            String motivo = e.getMessage() == null ? e.toString() : e.getMessage();
            log.error("Fallo el envio SMTP a {}: {}", destinatario, motivo);
            return EmailService.Resultado.fallo(motivo);
        }
    }
}
