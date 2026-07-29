package com.novacrm.postulacion;

import com.novacrm.seguimiento.EstadoContacto;

import java.util.Optional;

/**
 * Decide si un cambio de estado en una postulacion debe mover al estudiante de
 * columna en el tablero de seguimiento.
 *
 * <p>El estudiante actualiza sus postulaciones desde su cuenta y esos cambios
 * tienen que llegar al seguimiento del equipo; si no, el tablero envejece igual
 * que envejecia la hoja de calculo. Pero propagar el estado tal cual seria
 * peor: un participante con cinco procesos abiertos cambiaria de columna cada
 * vez que toca cualquiera de ellos.
 *
 * <p>De ahi las tres reglas, todas por el mismo motivo —el tablero solo debe
 * moverse cuando la situacion de la persona mejora de verdad—:
 *
 * <ol>
 *   <li><strong>Solo hacia adelante.</strong> Registrar hoy una postulacion
 *       nueva no devuelve a "en proceso" a quien ya tiene una entrevista.</li>
 *   <li><strong>Un rechazo no mueve nada.</strong> Que una empresa diga que no
 *       es informacion de ese proceso, no de la persona. Cerrarla por un
 *       rechazo la sacaria del tablero teniendo otras cuatro vivas.</li>
 *   <li><strong>De CERRADO no se sale solo.</strong> Alguien decidio dejar de
 *       hacerle seguimiento; que reaparezca actividad es motivo para avisar,
 *       no para deshacer esa decision sin que nadie se entere.</li>
 * </ol>
 *
 * <p>Clase sin dependencias, para poder probar las reglas sin base de datos.
 */
public final class AvanceDelTablero {

    private AvanceDelTablero() {
    }

    /**
     * @param actual estado de contacto que tiene hoy el estudiante
     * @param nuevo  estado al que acaba de pasar una de sus postulaciones
     * @return el estado al que hay que mover la tarjeta, o vacio si no se mueve
     */
    public static Optional<EstadoContacto> destino(EstadoContacto actual, EstadoPostulacion nuevo) {
        if (nuevo == null) {
            return Optional.empty();
        }
        var propuesto = nuevo.estadoDelEstudiante();
        if (propuesto.isEmpty()) {
            return Optional.empty();
        }
        EstadoContacto desde = actual == null ? EstadoContacto.INICIAL : actual;
        if (desde == EstadoContacto.CERRADO) {
            return Optional.empty();
        }
        return orden(propuesto.get()) > orden(desde) ? propuesto : Optional.empty();
    }

    /**
     * Posicion en la escalera del embudo.
     *
     * <p>{@code CERRADO} queda fuera con -1: no es un peldano mas alto ni mas
     * bajo, es salirse. Darle un numero lo metia en las comparaciones y hacia
     * que cualquier actividad reabriera un caso cerrado a mano.
     */
    private static int orden(EstadoContacto estado) {
        return switch (estado) {
            case SIN_CONTACTO -> 0;
            case EN_PROCESO -> 1;
            case ENTREVISTA -> 2;
            case COLOCADO -> 3;
            case CERRADO -> -1;
        };
    }
}
