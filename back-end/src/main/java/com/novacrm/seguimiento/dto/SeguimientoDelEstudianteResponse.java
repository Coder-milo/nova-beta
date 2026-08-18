package com.novacrm.seguimiento.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * El historial de acompañamiento visto por el propio estudiante.
 *
 * <p>Es el mismo que ve el equipo menos {@code responsable}. Ese campo se
 * rellena con {@code auth.getName()} en los caminos automáticos —registrar una
 * colocación, mover una tarjeta, cambiar el estado de una postulación—, y el
 * sujeto del token es el correo. Es decir, el historial del estudiante viajaba
 * a su navegador con la dirección de correo interna de quien hizo cada
 * anotación.
 *
 * <p>Ninguna pantalla del portal lo pinta, así que no se pierde nada al
 * quitarlo; iba en el JSON y ahí seguiría hasta el día en que alguien añadiera
 * una columna «quién» y lo publicara sin querer.
 *
 * <p>{@code observacion} sí se conserva: es lo que la pantalla enseña hoy y
 * decidir si el acompañamiento se le cuenta a la persona acompañada no es una
 * decisión técnica.
 */
public record SeguimientoDelEstudianteResponse(
        UUID id,
        LocalDate fecha,
        String tipo,
        String observacion,
        String proximaAccion,
        LocalDate fechaProxima,
        String estado,
        Instant createdAt) {

    public static SeguimientoDelEstudianteResponse de(SeguimientoResponse completo) {
        return new SeguimientoDelEstudianteResponse(
                completo.id(), completo.fecha(), completo.tipo(), completo.observacion(),
                completo.proximaAccion(), completo.fechaProxima(), completo.estado(),
                completo.createdAt());
    }
}
