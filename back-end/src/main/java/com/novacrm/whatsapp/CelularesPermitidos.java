package com.novacrm.whatsapp;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

/**
 * A que numeros se les puede escribir de verdad por WhatsApp.
 *
 * <p>El gemelo de {@code DestinatariosPermitidos} para el otro canal. El correo
 * lo tenia y WhatsApp no, aunque el riesgo es el mismo o mayor: la base de
 * desarrollo lleva los celulares reales de los 108 participantes, el proveedor
 * por defecto es Meta —el de verdad, no el simulado— y una plantilla enviada
 * no se puede recoger ni se deja de pagar.
 *
 * <p>Mientras {@code app.whatsapp.destinatarios-permitidos} tenga numeros,
 * <strong>solo se escribe a esos</strong>. Vacia habilita el envio real, que es
 * como esta en produccion.
 *
 * <p>Se compara en la forma normalizada, para que dar de alta
 * {@code 300 123 4567} valga igual que {@code +573001234567}: quien configura
 * esta lista la escribe a mano, y un espacio de mas no puede ser la diferencia
 * entre frenar un envio y no frenarlo.
 */
@Component
public class CelularesPermitidos {

    private final List<String> permitidos;

    public CelularesPermitidos(
            @Value("${app.whatsapp.destinatarios-permitidos:}") String configurados) {
        this.permitidos = normalizar(configurados);
    }

    private static List<String> normalizar(String configurados) {
        if (configurados == null || configurados.isBlank()) {
            return List.of();
        }
        return Arrays.stream(configurados.split(","))
                .map(String::trim)
                .filter(numero -> !numero.isEmpty())
                .map(WhatsappSender::normalizarDestino)
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    /** Vacia = sin restriccion. Con valores = solo a esos numeros. */
    public boolean hayRestriccion() {
        return !permitidos.isEmpty();
    }

    public boolean permite(String celular) {
        if (permitidos.isEmpty()) {
            return true;
        }
        String normalizado = WhatsappSender.normalizarDestino(celular);
        return normalizado != null && permitidos.contains(normalizado);
    }

    /** La lista tal cual, para que una pantalla pueda avisar de que existe. */
    public List<String> lista() {
        return permitidos;
    }
}
