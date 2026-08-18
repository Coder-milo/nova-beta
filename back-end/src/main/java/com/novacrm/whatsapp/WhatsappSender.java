package com.novacrm.whatsapp;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Servicio Façade de WhatsApp. Delega las operaciones de envío
 * al {@link ProveedorWhatsapp} activo (Meta Cloud API, Simulado, etc.).
 *
 * <p>Aquí se aplica {@link CelularesPermitidos}, igual que el correo aplica su
 * lista en {@code EmailService}: es la puerta por la que cruza todo lo que sale
 * por este canal, así que es donde no se puede olvidar.
 */
@Service
public class WhatsappSender {

    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(WhatsappSender.class);

    private final ProveedorWhatsapp proveedorWhatsapp;
    private final CelularesPermitidos celularesPermitidos;

    public WhatsappSender(ProveedorWhatsapp proveedorWhatsapp,
                          CelularesPermitidos celularesPermitidos) {
        this.proveedorWhatsapp = proveedorWhatsapp;
        this.celularesPermitidos = celularesPermitidos;
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

    /** Botón de respuesta rápida de una plantilla. */
    public record BotonRapido(String payload, String texto) {}

    /** El canal del programa, con token descifrado, o null si no usable. */
    public record Canal(String phoneId, String token) {}

    /** Si el programa tiene un canal activo y configurado. */
    public boolean estaConfigurado(UUID programaId) {
        return proveedorWhatsapp.estaConfigurado(programaId);
    }

    /** El canal del programa, con token descifrado, o null si no usable. */
    public Canal activo(UUID programaId) {
        return proveedorWhatsapp.activo(programaId);
    }

    /** Envía un mensaje de texto. */
    public Resultado enviarTexto(UUID programaId, String celularDestino, String texto) {
        if (fueraDeLaLista(celularDestino)) {
            return Resultado.fallo("Numero fuera de la lista de pruebas permitida");
        }
        return proveedorWhatsapp.enviarTexto(programaId, celularDestino, texto);
    }

    /** Envía una plantilla aprobada. */
    public Resultado enviarPlantilla(UUID programaId, String celularDestino, String nombrePlantilla,
                                     List<String> parametrosCuerpo,
                                     List<BotonRapido> botones) {
        if (fueraDeLaLista(celularDestino)) {
            return Resultado.fallo("Numero fuera de la lista de pruebas permitida");
        }
        return proveedorWhatsapp.enviarPlantilla(programaId, celularDestino, nombrePlantilla, parametrosCuerpo, botones);
    }

    /**
     * Si hay lista de pruebas y este número no está en ella.
     *
     * <p>En producción la lista está vacía y esto no hace nada. En un entorno
     * con datos copiados es lo único que impide que una corrida de matching le
     * mande decenas de plantillas a los celulares reales de la cohorte —y una
     * plantilla enviada ni se recoge ni se deja de pagar.
     */
    private boolean fueraDeLaLista(String celularDestino) {
        if (!celularesPermitidos.hayRestriccion() || celularesPermitidos.permite(celularDestino)) {
            return false;
        }
        log.info("WhatsApp a {} omitido: no está en app.whatsapp.destinatarios-permitidos",
                celularDestino);
        return true;
    }

    /**
     * Normaliza un celular a E.164: quita separadores y añade el indicativo de Colombia (+57).
     */
    public static String normalizarDestino(String celular) {
        if (celular == null) return null;
        String digitos = celular.replaceAll("[\\s()\\-.]", "");
        if (digitos.startsWith("+")) {
            digitos = digitos.substring(1);
        }
        if (digitos.matches("\\d{10}") && digitos.startsWith("3")) {
            digitos = "57" + digitos;
        }
        return digitos.matches("\\+?[1-9][0-9]{7,14}") ? "+" + digitos.replace("+", "") : null;
    }
}
