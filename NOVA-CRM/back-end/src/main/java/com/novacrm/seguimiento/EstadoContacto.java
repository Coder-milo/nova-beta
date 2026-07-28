package com.novacrm.seguimiento;

import java.util.Arrays;
import java.util.Optional;

/**
 * En que punto de la conversacion esta un estudiante.
 *
 * <p><strong>Esto se captura; la etapa del pipeline se deduce.</strong> Son dos
 * ejes distintos y conviene no mezclarlos: {@code EtapaEmpleabilidad} sale de
 * hechos que ya registran otros modulos (HV vigente, simulacro hecho,
 * postulaciones) y nadie la puede mover a mano. El estado de contacto lo decide
 * la persona que hace el seguimiento, y por eso es lo unico que el tablero
 * arrastra entre columnas.
 *
 * <p>Un estudiante puede estar en {@code POSTULANDO} y aun asi con el contacto
 * {@code SIN_CONTACTO}: significa que el sistema ve actividad suya pero nadie
 * del equipo ha hablado con el. Justo esa combinacion es la que hay que ver.
 */
public enum EstadoContacto {

    /** Nadie del equipo ha hablado con el todavia. Es el estado inicial. */
    SIN_CONTACTO,

    /** Hay conversacion abierta: se le escribio, respondio, se le acompana. */
    EN_PROCESO,

    /** Tiene al menos un proceso de seleccion vivo con una empresa. */
    ENTREVISTA,

    /** Consiguio trabajo. */
    COLOCADO,

    /**
     * Se deja de hacer seguimiento: se retiro, no responde o pidio salir.
     * No es lo mismo que COLOCADO y no debe contarse como exito.
     */
    CERRADO;

    /** El estado con el que empieza quien nunca ha sido contactado. */
    public static final EstadoContacto INICIAL = SIN_CONTACTO;

    /**
     * El {@code tipo} de {@code Seguimiento} que registra un cambio de estado.
     *
     * <p>{@code Seguimiento.tipo} es texto libre y ya guarda otras cosas
     * (SIMULACRO, LLAMADA...). Se marca con este valor para poder distinguir
     * los movimientos del tablero del resto del historial sin tocar lo que ya
     * existe.
     */
    public static final String TIPO = "CONTACTO";

    /**
     * Interpreta el estado guardado en un {@code Seguimiento}.
     *
     * <p>Devuelve vacio si no reconoce el texto en vez de reventar: la columna
     * es un {@code String} libre y lleva anos aceptando valores como
     * "PENDIENTE". Un valor viejo no debe tumbar el tablero entero.
     */
    public static Optional<EstadoContacto> desde(String valor) {
        if (valor == null || valor.isBlank()) {
            return Optional.empty();
        }
        String limpio = valor.trim().toUpperCase();
        return Arrays.stream(values()).filter(e -> e.name().equals(limpio)).findFirst();
    }

    /** Si a partir de aqui ya no se espera mas gestion. */
    public boolean esFinal() {
        return this == COLOCADO || this == CERRADO;
    }
}
