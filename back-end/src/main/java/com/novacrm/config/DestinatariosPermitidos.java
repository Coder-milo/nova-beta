package com.novacrm.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

/**
 * A quien se le puede escribir de verdad.
 *
 * <p>Mientras {@code app.correo.destinatarios-permitidos} tenga direcciones,
 * <strong>solo se escribe a esas</strong>, aunque se dispare un envio a los 108
 * estudiantes. Vaciarla habilita el envio real.
 *
 * <p>Vive en un componente propio y no repetida en cada servicio que envia:
 * es la unica cosa que separa una prueba de un envio masivo a personas reales,
 * y dos copias de esa comprobacion son dos sitios donde puede quedar mal.
 */
@Component
public class DestinatariosPermitidos {

    private final List<String> permitidos;

    public DestinatariosPermitidos(
            @Value("${app.correo.destinatarios-permitidos:}") String configurados) {
        this.permitidos = normalizar(configurados);
    }

    private static List<String> normalizar(String configurados) {
        if (configurados == null || configurados.isBlank()) {
            return List.of();
        }
        return Arrays.stream(configurados.split(","))
                .map(String::trim)
                .filter(d -> !d.isEmpty())
                .toList();
    }

    /** Vacia = sin restriccion. Con valores = solo a esas direcciones. */
    public boolean hayRestriccion() {
        return !permitidos.isEmpty();
    }

    public boolean permite(String email) {
        if (permitidos.isEmpty()) {
            return true;
        }
        return email != null && permitidos.stream().anyMatch(d -> d.equalsIgnoreCase(email.trim()));
    }

    /** La lista tal cual, para que la pantalla pueda avisar de que existe. */
    public List<String> lista() {
        return permitidos;
    }
}
