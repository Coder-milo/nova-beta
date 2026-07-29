package com.novacrm.config;

/**
 * Canal de salida de correo.
 *
 * <p>Existe para que el resto de la aplicacion no sepa por donde sale el
 * mensaje. Hoy hay dos implementaciones —SMTP y Amazon SES— y se elige por
 * configuracion; manana puede haber otra sin tocar quien envia.
 */
public interface CorreoSender {

    /** Si el canal tiene lo necesario para enviar. */
    boolean estaConfigurado();

    /** Nombre del canal, para poder decir en los mensajes de error cual fallo. */
    String descripcion();

    EmailService.Resultado enviar(String destinatario, String asunto, String htmlBody);
}
