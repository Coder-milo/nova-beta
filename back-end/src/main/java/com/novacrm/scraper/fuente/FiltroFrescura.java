package com.novacrm.scraper.fuente;

import com.novacrm.vacante.Vacante;
import java.time.LocalDateTime;

/**
 * Validador de frescura temporal para ofertas de empleo.
 *
 * <p>Aplica la regla estricta de una ventana de antigüedad máxima de 7 días
 * ({@code fechaPublicacion >= ahora.minusDays(7)}).
 *
 * <p>Rechaza cualquier vacante con fecha nula o no verificable.
 * Admite una tolerancia superior de hasta +1 día para acomodar discrepancias
 * de zona horaria internacional (ej. servidores UTC vs. zona horaria Colombia GMT-5).
 */
public final class FiltroFrescura {

    public static final int DIAS_MAXIMOS_DEFECTO = 7;

    private FiltroFrescura() {}

    /**
     * Evalúa si una fecha de publicación está dentro de la ventana de días permitida respecto a una fecha de referencia.
     */
    public static boolean esFresca(LocalDateTime fechaPublicacion, LocalDateTime referencia, int diasMaximos) {
        if (fechaPublicacion == null || referencia == null || diasMaximos < 0) {
            return false;
        }
        LocalDateTime limiteInferior = referencia.minusDays(diasMaximos);
        LocalDateTime limiteSuperior = referencia.plusDays(1);

        return !fechaPublicacion.isBefore(limiteInferior) && !fechaPublicacion.isAfter(limiteSuperior);
    }

    /**
     * Evalúa si una fecha de publicación cumple con la ventana por defecto de 7 días.
     */
    public static boolean esFresca(LocalDateTime fechaPublicacion, LocalDateTime referencia) {
        return esFresca(fechaPublicacion, referencia, DIAS_MAXIMOS_DEFECTO);
    }

    /**
     * Evalúa si una fecha de publicación cumple con la ventana de 7 días respecto a la hora actual del sistema.
     */
    public static boolean esFresca(LocalDateTime fechaPublicacion) {
        return esFresca(fechaPublicacion, LocalDateTime.now(), DIAS_MAXIMOS_DEFECTO);
    }

    /**
     * Evalúa si una vacante cumple con la regla de frescura respecto a una fecha de referencia.
     */
    public static boolean esFresca(Vacante vacante, LocalDateTime referencia) {
        if (vacante == null) {
            return false;
        }
        return esFresca(vacante.getFechaPublicacion(), referencia, DIAS_MAXIMOS_DEFECTO);
    }

    /**
     * Evalúa si una vacante cumple con la regla de frescura respecto a la hora actual.
     */
    public static boolean esFresca(Vacante vacante) {
        return esFresca(vacante, LocalDateTime.now());
    }

    /**
     * Método de compatibilidad para evaluar si una fecha está dentro de los últimos N días.
     */
    public static boolean esDentroDeUltimosDias(LocalDateTime fecha, int diasMaximos, LocalDateTime referencia) {
        return esFresca(fecha, referencia, diasMaximos);
    }
}
