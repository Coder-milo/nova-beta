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

    @Value("${app.ses.source-email}")
    private String fromEmail;

    public EmailService(SesClient sesClient) {
        this.sesClient = sesClient;
    }

    public void enviar(String to, String subject, String htmlBody) {
        try {
            var request = SendEmailRequest.builder()
                    .source(fromEmail)
                    .destination(Destination.builder().toAddresses(to).build())
                    .message(Message.builder()
                            .subject(Content.builder().data(subject).charset("UTF-8").build())
                            .body(Body.builder()
                                    .html(Content.builder().data(htmlBody).charset("UTF-8").build())
                                    .build())
                            .build())
                    .build();
            sesClient.sendEmail(request);
            log.info("Email enviado a: {}", to);
        } catch (SesException e) {
            log.error("Error enviando email a {}: {}", to, e.awsErrorDetails().errorMessage());
        }
    }
}
