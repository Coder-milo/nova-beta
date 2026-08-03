package com.novacrm.estudiante;

import java.time.LocalDate;
import java.time.Period;

/**
 * Resuelve la edad de un participante.
 *
 * <p>La hoja de seguimiento guarda la edad como un numero suelto, y una edad
 * suelta deja de ser cierta al año siguiente: los 107 participantes cumplirian
 * años en el papel el dia que alguien reimportara el archivo. Por eso lo que
 * se guarda es la fecha de nacimiento.
 *
 * <p>Como de la hoja solo se puede importar la edad, se admite tambien el par
 * (edad, fecha en que se capturo), que si se puede envejecer. En cuanto haya
 * fecha de nacimiento manda esa, porque es exacta.
 */
public final class EdadParticipante {

    private EdadParticipante() {
    }

    /**
     * @param fechaNacimiento  exacta; si esta, gana
     * @param edadAlRegistrar  edad capturada en la hoja
     * @param fechaCaptura     cuando se capturo esa edad
     * @param hoy              fecha de referencia (parametro para poder probarlo)
     * @return la edad, o {@code null} si no hay con que calcularla
     */
    public static Integer resolver(LocalDate fechaNacimiento,
                                   Integer edadAlRegistrar,
                                   LocalDate fechaCaptura,
                                   LocalDate hoy) {
        if (fechaNacimiento != null && !fechaNacimiento.isAfter(hoy)) {
            return Period.between(fechaNacimiento, hoy).getYears();
        }
        if (edadAlRegistrar == null || fechaCaptura == null || fechaCaptura.isAfter(hoy)) {
            return null;
        }
        return edadAlRegistrar + Period.between(fechaCaptura, hoy).getYears();
    }
}
