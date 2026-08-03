package com.novacrm.empresa;

/**
 * En que punto esta la relacion con una empresa.
 *
 * <p>El equipo llevaba esto en una hoja aparte porque aqui la empresa era un
 * catalogo colgado de las vacantes: nombre, sector y poco mas. Sin estado de
 * relacion no hay forma de saber a quien ya se le escribio, y se acaba tocando
 * la misma puerta dos veces —o ninguna—.
 */
public enum EstadoRelacion {

    SIN_CONTACTAR("Sin contactar"),

    /** Se escribio o se llamo; todavia sin respuesta. */
    CONTACTADA("Contactada"),

    /** Se le mandaron perfiles de participantes. */
    PERFIL_ENVIADO("Perfil enviado"),

    /** Hay conversacion viva: pidio perfiles, agendo entrevistas. */
    EN_CONVERSACION("En conversacion"),

    /** Relacion establecida: recibe perfiles de forma recurrente. */
    ALIADA("Aliada"),

    /** No hay encaje o pidio no ser contactada. No se vuelve a escribir. */
    DESCARTADA("Descartada");

    private final String etiqueta;

    EstadoRelacion(String etiqueta) {
        this.etiqueta = etiqueta;
    }

    public String getEtiqueta() {
        return etiqueta;
    }

    /** Si sigue siendo una puerta abierta. */
    public boolean estaViva() {
        return this != DESCARTADA;
    }

    /** Si ya se hizo algun acercamiento. */
    public boolean fueContactada() {
        return this != SIN_CONTACTAR;
    }
}
