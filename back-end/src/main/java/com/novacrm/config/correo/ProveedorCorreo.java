package com.novacrm.config.correo;

import com.novacrm.config.EmailService;

/**
 * Contrato unificado para proveedores de envío de correo electrónico (SMTP, AWS SES, SendGrid, Noop).
 */
public interface ProveedorCorreo {

    /** Nombre identificador del proveedor (ej. "smtp", "ses", "noop"). */
    String nombre();

    /** Si el canal de correo está correctamente configurado para enviar. */
    boolean estaConfigurado();

    /** Nombre descriptivo legible del canal activo. */
    String canalActivo();

    /** Envia un correo electrónico. */
    EmailService.Resultado enviar(String destinatario, String asunto, String htmlBody);
}
