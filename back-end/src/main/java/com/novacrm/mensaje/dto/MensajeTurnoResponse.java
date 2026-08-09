package com.novacrm.mensaje.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Una intervencion del hilo, lista para pintarse.
 *
 * @param autorNombre        como se muestra; el correo no se envia al estudiante
 * @param enRespuestaA       turno citado, o nulo
 * @param enRespuestaAExtracto primeras palabras del turno citado, para dibujar
 *                             la cita sin tener que buscarlo en la lista
 * @param historico            true cuando la intervencion no existe como fila
 *                             de {@code mensaje_turno} y se reconstruyo del
 *                             mensaje antiguo. No se le puede reaccionar ni
 *                             citar, porque no hay a que apuntar; la pantalla
 *                             lo usa para no ofrecer lo que va a fallar
 */
public record MensajeTurnoResponse(
        UUID id,
        String autorNombre,
        boolean autorEsEstudiante,
        String contenido,
        Instant createdAt,
        UUID enRespuestaA,
        String enRespuestaAExtracto,
        List<MensajeAdjuntoResponse> adjuntos,
        List<ReaccionResumen> reacciones,
        boolean historico) {

    /** Un turno de verdad: existe en la base y admite reacciones y citas. */
    public MensajeTurnoResponse(UUID id, String autorNombre, boolean autorEsEstudiante,
                                String contenido, Instant createdAt, UUID enRespuestaA,
                                String enRespuestaAExtracto, List<MensajeAdjuntoResponse> adjuntos,
                                List<ReaccionResumen> reacciones) {
        this(id, autorNombre, autorEsEstudiante, contenido, createdAt, enRespuestaA,
                enRespuestaAExtracto, adjuntos, reacciones, false);
    }

    /**
     * Cuantos pusieron cada emoji, y si uno de ellos fue quien mira.
     *
     * <p>Deliberadamente no viaja la lista de quienes reaccionaron. Para pintar
     * el contador y saber si el boton va marcado basta con esto, y enviar los
     * correos convertiria cada hilo en un directorio de la cohorte —que es la
     * misma fuga que ya habia en el listado de vacantes—.
     */
    public record ReaccionResumen(String emoji, int total, boolean mia) { }
}
