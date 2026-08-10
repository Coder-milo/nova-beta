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

    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(CelularesPermitidos.class);

    /** Si alguien puso algo en la propiedad, aunque no se entienda. */
    private final boolean configurada;
    private final List<String> permitidos;

    public CelularesPermitidos(
            @Value("${app.whatsapp.destinatarios-permitidos:}") String configurados) {
        this.configurada = configurados != null && !configurados.isBlank();
        this.permitidos = normalizar(configurados);
        if (configurada && permitidos.isEmpty()) {
            log.warn("app.whatsapp.destinatarios-permitidos tiene valor pero no se entendio "
                    + "ningun numero: no saldra ningun WhatsApp hasta corregirla. "
                    + "Se separan por comas y en formato +57XXXXXXXXXX.");
        }
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

    /**
     * Vacia = sin restriccion. Con valores = solo a esos numeros.
     *
     * <p>Mira si la propiedad trae algo, no si se entendio. Antes miraba la
     * lista ya normalizada, y los numeros que no se entienden se descartan en
     * silencio: separar con punto y coma en vez de con coma dejaba la lista
     * vacia y con ella <em>desaparecia la restriccion entera</em>. Es decir,
     * escribir mal el freno soltaba el freno, y el envio salia a los celulares
     * reales de los 108 participantes.
     *
     * <p>Ahora una lista que no se entiende no deja pasar nada. Se nota en
     * seguida —no sale ningun mensaje— y el log dice por que, que es la forma
     * segura de equivocarse.
     */
    public boolean hayRestriccion() {
        return configurada;
    }

    /**
     * Sin restriccion pasa todo; con restriccion, solo los de la lista.
     *
     * <p>La condicion es «no hay nada configurado», no «la lista quedo vacia»:
     * son distintas justo cuando lo que se escribio no se entendio, que es
     * cuando hace falta frenar y no soltar.
     */
    public boolean permite(String celular) {
        if (!configurada) {
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
