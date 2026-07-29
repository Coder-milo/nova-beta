package com.novacrm.postulacion;

import com.novacrm.seguimiento.EstadoContacto;

/**
 * En que punto va una postulacion concreta.
 *
 * <p>Es distinto del estado del estudiante. {@link EstadoContacto} responde a
 * "como va esta persona"; esto responde a "como va este proceso". La misma
 * persona puede tener una entrevista agendada en una empresa, un rechazo en
 * otra y tres postulaciones sin respuesta, y las cinco cosas son ciertas a la
 * vez. Con un unico estado por estudiante habia que elegir una y perder las
 * demas.
 *
 * <p>Los nombres y el orden son los de la hoja de seguimiento, para que quien
 * la venia usando reconozca lo que ve.
 */
public enum EstadoPostulacion {

    ENVIADA("Enviada", EstadoContacto.EN_PROCESO),
    EN_PROCESO("En proceso", EstadoContacto.EN_PROCESO),
    ENTREVISTA_AGENDADA("Entrevista agendada", EstadoContacto.ENTREVISTA),
    ENTREVISTA_REALIZADA("Entrevista realizada", EstadoContacto.ENTREVISTA),
    RECHAZADO("Rechazado", null),
    CONTRATADO("Contratado", EstadoContacto.COLOCADO),
    SIN_RESPUESTA("Sin respuesta", null);

    private final String etiqueta;

    /**
     * A que estado del tablero mueve al estudiante, si es que lo mueve.
     *
     * <p>Nulo en {@link #RECHAZADO} y {@link #SIN_RESPUESTA} a proposito: que
     * una empresa diga que no es informacion de ese proceso, no del estudiante.
     * Moverlo a "cerrado" por un rechazo lo sacaria del tablero teniendo otras
     * cuatro postulaciones vivas.
     */
    private final EstadoContacto estadoDelEstudiante;

    EstadoPostulacion(String etiqueta, EstadoContacto estadoDelEstudiante) {
        this.etiqueta = etiqueta;
        this.estadoDelEstudiante = estadoDelEstudiante;
    }

    public String getEtiqueta() {
        return etiqueta;
    }

    /** El estado de tablero al que arrastra, o vacio si no arrastra a ninguno. */
    public java.util.Optional<EstadoContacto> estadoDelEstudiante() {
        return java.util.Optional.ofNullable(estadoDelEstudiante);
    }

    /** El proceso termino: ya no hay nada que esperar de esta empresa. */
    public boolean esFinal() {
        return this == RECHAZADO || this == CONTRATADO || this == SIN_RESPUESTA;
    }

    /** Hubo respuesta de la empresa, del signo que sea. */
    public boolean implicaRespuesta() {
        return this != ENVIADA && this != SIN_RESPUESTA;
    }

    /**
     * Que un estudiante marque "contratado" es una noticia, no un dato
     * verificado. La colocacion —con contrato, salario y checklist— la
     * registra el equipo. Sirve para avisar, no para contar.
     */
    public boolean requiereConfirmacionDelEquipo() {
        return this == CONTRATADO;
    }

    public static java.util.Optional<EstadoPostulacion> desde(String texto) {
        if (texto == null || texto.isBlank()) {
            return java.util.Optional.empty();
        }
        String limpio = texto.trim().toUpperCase().replace(' ', '_');
        for (EstadoPostulacion e : values()) {
            if (e.name().equals(limpio)) {
                return java.util.Optional.of(e);
            }
        }
        // La hoja escribia "Enviado" en masculino.
        if ("ENVIADO".equals(limpio)) {
            return java.util.Optional.of(ENVIADA);
        }
        return java.util.Optional.empty();
    }
}
