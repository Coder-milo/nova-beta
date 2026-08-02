package com.novacrm.matching;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Resultado de evaluar un par estudiante×vacante, criterio por criterio.
 *
 * <p>Cada criterio vale entre 0 y 1, o {@code null} cuando no hay con que
 * juzgarlo. Esa distincion es el arreglo central del motor: antes un dato que
 * faltaba se puntuaba como si fuera bueno —una vacante sin nivel de ingles y
 * sin experiencia declarada se llevaba los 40 puntos de ambos criterios—, de
 * modo que las vacantes de las que no se sabia nada le ganaban a las bien
 * descritas y todo el mundo superaba el umbral.
 *
 * <p>Ahora los criterios sin datos simplemente no entran en la cuenta: el
 * puntaje se reparte entre los que si tienen. Se guarda ademas la
 * {@link #cobertura}, que dice cuanto peso respaldaba ese puntaje, para poder
 * exigir un minimo de evidencia y no recomendar a ciegas.
 */
public record DesglosePuntaje(
        Double afinidad,
        Double habilidades,
        Double ingles,
        Double ubicacion,
        Double experiencia,
        BigDecimal puntaje,
        BigDecimal cobertura) {

    /** Acumula los criterios evaluados y reparte el puntaje solo entre ellos. */
    static final class Balanza {

        private double sumaPonderada;
        private double sumaPesos;

        /** @param ratio 0..1, o {@code null} si el criterio no se pudo evaluar */
        void agregar(int peso, Double ratio) {
            if (ratio == null) {
                return;
            }
            sumaPonderada += peso * ratio;
            sumaPesos += peso;
        }

        /** Puntaje 0..100 renormalizado sobre el peso que si tenia datos. */
        BigDecimal puntaje() {
            if (sumaPesos <= 0) {
                return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            }
            return BigDecimal.valueOf(100 * sumaPonderada / sumaPesos)
                    .setScale(2, RoundingMode.HALF_UP);
        }

        /** Fraccion del peso total que se pudo evaluar, de 0 a 1. */
        BigDecimal cobertura(int pesoTotal) {
            if (pesoTotal <= 0) {
                return BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
            }
            return BigDecimal.valueOf(sumaPesos / pesoTotal).setScale(4, RoundingMode.HALF_UP);
        }
    }
}
