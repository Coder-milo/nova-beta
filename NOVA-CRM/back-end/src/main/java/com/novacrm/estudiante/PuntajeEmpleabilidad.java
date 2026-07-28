package com.novacrm.estudiante;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * El "% de empleabilidad" que el programa reporta, calculado igual que en la
 * hoja de seguimiento.
 *
 * <p>Se replica la formula de la hoja al detalle —incluidas sus rarezas— por
 * una razon concreta: el promedio publicado del programa es 31,5&nbsp;% y sale
 * de ahi. Si el CRM calculara "algo parecido pero mejor", el dia que sustituya
 * a la hoja el indicador cambiaria de valor sin que nadie hubiera cambiado de
 * situacion, y no habria forma de explicarle al financiador si la diferencia
 * es el programa o el cambio de sistema.
 *
 * <p>Verificado contra las 107 filas de la hoja: coincide en las 107.
 *
 * <p>Es una clase sin dependencias a proposito, para poder ejercitarla sin
 * Spring ni base de datos.
 */
public final class PuntajeEmpleabilidad {

    /** Hoja de vida terminada. */
    public static final BigDecimal PESO_CV = new BigDecimal("0.15");
    /** Hoja de vida en ingles: el diferenciador del programa. */
    public static final BigDecimal PESO_CV_INGLES = new BigDecimal("0.15");
    /** Tener perfil de LinkedIn. Pesa menos porque crearlo es barato. */
    public static final BigDecimal PESO_LINKEDIN_CREADO = new BigDecimal("0.10");
    /** Perfil de LinkedIn trabajado. Distinto de tenerlo. */
    public static final BigDecimal PESO_LINKEDIN_OPTIMIZADO = new BigDecimal("0.15");
    /** Perfil ocupacional definido. */
    public static final BigDecimal PESO_PERFIL_OCUPACIONAL = new BigDecimal("0.15");
    /** Colocado laboralmente. Es casi un tercio del puntaje. */
    public static final BigDecimal PESO_COLOCADO = new BigDecimal("0.30");

    /**
     * Lo que suma un hito a medias.
     *
     * <p>Es un valor fijo, el mismo para los cinco hitos, y no la mitad del
     * peso de cada uno. Es una rareza de la hoja —presumiblemente un unico
     * {@code IF} copiado a las cinco columnas— y se conserva porque cambiarla
     * moveria el promedio publicado.
     */
    public static final BigDecimal APORTE_EN_PROCESO = new BigDecimal("0.07");

    private PuntajeEmpleabilidad() {
    }

    /**
     * Puntaje entre 0 y 1 con dos decimales.
     *
     * @param colocado si tiene una colocacion laboral registrada
     */
    public static BigDecimal calcular(PreparacionEmpleabilidad preparacion, boolean colocado) {
        PreparacionEmpleabilidad p = preparacion == null ? new PreparacionEmpleabilidad() : preparacion;
        BigDecimal total = aporte(p.getCvListo(), PESO_CV)
                .add(aporte(p.getCvEnIngles(), PESO_CV_INGLES))
                .add(aporte(p.getLinkedinCreado(), PESO_LINKEDIN_CREADO))
                .add(aporte(p.getLinkedinOptimizado(), PESO_LINKEDIN_OPTIMIZADO))
                .add(aporte(p.getPerfilOcupacional(), PESO_PERFIL_OCUPACIONAL));
        if (colocado) {
            total = total.add(PESO_COLOCADO);
        }
        // Truncado, no redondeado: es lo que hace la hoja. Con 0,475 publica
        // 0,47, y redondear daria 0,48 en 30 y pico de fichas.
        return total.setScale(2, RoundingMode.DOWN);
    }

    /** El mismo puntaje expresado en porcentaje entero, para mostrarlo. */
    public static int porcentaje(PreparacionEmpleabilidad preparacion, boolean colocado) {
        return calcular(preparacion, colocado)
                .multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.DOWN)
                .intValue();
    }

    private static BigDecimal aporte(EstadoHito estado, BigDecimal peso) {
        if (estado == null) {
            return BigDecimal.ZERO;
        }
        return switch (estado) {
            case SI -> peso;
            case EN_PROCESO -> APORTE_EN_PROCESO;
            case NO -> BigDecimal.ZERO;
        };
    }
}
