package com.novacrm.config.correo;

import com.novacrm.config.EmailService;
import com.novacrm.config.TextoPlano;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.ses.SesClient;
import software.amazon.awssdk.services.ses.model.*;

/**
 * Implementación de {@link ProveedorCorreo} que utiliza Amazon SES.
 */
@Component
public class SesProveedorCorreo implements ProveedorCorreo {

    private static final Logger log = LoggerFactory.getLogger(SesProveedorCorreo.class);

    private final SesClient sesClient;
    private final String fromEmail;
    private final String accessKey;

    public SesProveedorCorreo(SesClient sesClient,
                              @Value("${app.ses.source-email:noreply@novacrm.com}") String fromEmail,
                              @Value("${AWS_ACCESS_KEY_ID:}") String accessKey) {
        this.sesClient = sesClient;
        this.fromEmail = fromEmail;
        this.accessKey = accessKey;
    }

    @Override
    public String nombre() {
        return "ses";
    }

    @Override
    public boolean estaConfigurado() {
        return accessKey != null && !accessKey.isBlank();
    }

    @Override
    public String canalActivo() {
        return "SES";
    }

    @Override
    public EmailService.Resultado enviar(String destinatario, String asunto, String htmlBody) {
        if (!estaConfigurado()) {
            return EmailService.Resultado.fallo("Amazon SES no configurado (AWS_ACCESS_KEY_ID vacío).");
        }
        try {
            var request = SendEmailRequest.builder()
                    .source(fromEmail)
                    .destination(Destination.builder().toAddresses(destinatario).build())
                    .message(Message.builder()
                            .subject(Content.builder().data(asunto).charset("UTF-8").build())
                            .body(Body.builder()
                                    .html(Content.builder().data(htmlBody).charset("UTF-8").build())
                                    .text(Content.builder()
                                            .data(TextoPlano.deHtml(htmlBody))
                                            .charset("UTF-8").build())
                                    .build())
                            .build())
                    .build();
            sesClient.sendEmail(request);
            log.info("Email enviado por SES a: {}", destinatario);
            return EmailService.Resultado.ok();
        } catch (SesException e) {
            String motivo = e.awsErrorDetails() == null ? e.getMessage() : e.awsErrorDetails().errorMessage();
            log.error("Error enviando email vía SES a {}: {}", destinatario, motivo);
            return EmailService.Resultado.fallo(motivo);
        } catch (Exception e) {
            log.error("Error inesperado enviando email vía SES a {}: {}", destinatario, e.getMessage());
            return EmailService.Resultado.fallo(e.getMessage());
        }
    }
}
