package com.novacrm.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.ses.SesClient;
import software.amazon.awssdk.services.ses.model.*;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final SesClient sesClient;

    /** Canal alternativo (SMTP). Ausente si no hay servidor configurado. */
    private final java.util.Optional<CorreoSmtpSender> senderExterno;

    @Value("${app.ses.source-email}")
    private String fromEmail;

    @Value("${AWS_ACCESS_KEY_ID:}")
    private String accessKey;

    public EmailService(SesClient sesClient,
                        java.util.Optional<CorreoSmtpSender> senderExterno) {
        this.sesClient = sesClient;
        this.senderExterno = senderExterno;
    }

    /** Resultado de un envio. */
    public record Resultado(boolean enviado, String motivoFallo) {
        public static Resultado ok() {
            return new Resultado(true, null);
        }

        public static Resultado fallo(String motivo) {
            return new Resultado(false, motivo);
        }
    }

    /** Si hay algun canal capaz de enviar. */
    public boolean estaConfigurado() {
        return smtpDisponible() || sesDisponible();
    }

    /** Que canal se usaria ahora mismo. Util para diagnosticar. */
    public String canalActivo() {
        if (smtpDisponible()) return "SMTP";
        if (sesDisponible()) return "SES";
        return "ninguno";
    }

    private boolean smtpDisponible() {
        return senderExterno.map(CorreoSmtpSender::estaConfigurado).orElse(false);
    }

    private boolean sesDisponible() {
        return accessKey != null && !accessKey.isBlank();
    }

    /**
     * Envia un correo y <strong>devuelve si lo consiguio</strong>.
     *
     * <p>Antes este metodo se tragaba la excepcion de SES y solo la escribia en
     * el log. En un envio masivo de credenciales eso es peligroso: el
     * coordinador veria "listo" mientras ningun estudiante recibio su
     * contrasena. Ahora el fallo se devuelve para que quien llama decida.
     */
    public Resultado enviar(String to, String subject, String htmlBody) {
        // SMTP tiene prioridad: es el canal que se configura para el dia a dia.
        if (smtpDisponible()) {
            return senderExterno.orElseThrow().enviar(to, subject, htmlBody);
        }

        if (!sesDisponible()) {
            String motivo = "No hay canal de correo configurado. Define un servidor SMTP "
                    + "(spring.mail.*) o las credenciales de SES.";
            log.warn("No se envio el correo a {}: {}", to, motivo);
            return Resultado.fallo(motivo);
        }
        try {
            var request = SendEmailRequest.builder()
                    .source(fromEmail)
                    .destination(Destination.builder().toAddresses(to).build())
                    .message(Message.builder()
                            .subject(Content.builder().data(subject).charset("UTF-8").build())
                            // Igual que en SMTP: las dos versiones, porque un
                            // mensaje solo-HTML puntua peor en los antispam.
                            .body(Body.builder()
                                    .html(Content.builder().data(htmlBody).charset("UTF-8").build())
                                    .text(Content.builder()
                                            .data(TextoPlano.deHtml(htmlBody))
                                            .charset("UTF-8").build())
                                    .build())
                            .build())
                    .build();
            sesClient.sendEmail(request);
            log.info("Email enviado a: {}", to);
            return Resultado.ok();
        } catch (SesException e) {
            String motivo = e.awsErrorDetails() == null
                    ? e.getMessage()
                    : e.awsErrorDetails().errorMessage();
            log.error("Error enviando email a {}: {}", to, motivo);
            return Resultado.fallo(motivo);
        } catch (Exception e) {
            log.error("Error inesperado enviando email a {}: {}", to, e.getMessage());
            return Resultado.fallo(e.getMessage());
        }
    }
}
