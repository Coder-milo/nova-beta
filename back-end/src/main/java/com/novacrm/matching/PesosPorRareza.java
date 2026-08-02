package com.novacrm.matching;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * Cuanto informa cada token, medido sobre el pool de vacantes de la corrida.
 *
 * <p>Al conservar la cola larga del vocabulario entra ruido: coincidir en
 * "sistemas" o en "cliente" —que salen en media bolsa de empleo— pesaba lo
 * mismo que coincidir en "ccna" o en "zendesk". Aqui se corrige con la
 * frecuencia documental: un token que aparece en casi todas las vacantes apenas
 * suma, y uno que aparece en pocas suma mucho.
 *
 * <p>Un token que no aparece en <em>ninguna</em> vacante del pool pesa cero, no
 * el maximo. Es la misma decision que tomo el scorer con los datos que faltan:
 * "no hay evidencia" no puede tratarse como "evidencia fuerte". Tratarlo al
 * reves castigaria justo a quien llena su perfil profesional, porque cada
 * palabra suelta que el mercado no usa le hundiria el denominador.
 */
final class PesosPorRareza {

    private final Map<String, Double> pesos;

    private PesosPorRareza(Map<String, Double> pesos) {
        this.pesos = pesos;
    }

    /** @param documentos tokens de cada vacante del pool, una entrada por vacante */
    static PesosPorRareza de(Collection<Set<String>> documentos) {
        Map<String, Integer> frecuencia = new HashMap<>();
        int total = 0;
        for (Set<String> tokens : documentos) {
            if (tokens == null || tokens.isEmpty()) continue;
            total++;
            for (String token : tokens) {
                frecuencia.merge(token, 1, Integer::sum);
            }
        }

        Map<String, Double> pesos = new HashMap<>();
        if (total > 0) {
            for (var entrada : frecuencia.entrySet()) {
                // ln(N/df) + 1: el "+1" evita que un token presente en todas
                // las vacantes valga exactamente cero y desaparezca del reparto.
                pesos.put(entrada.getKey(),
                        Math.log((double) total / entrada.getValue()) + 1.0);
            }
        }
        return new PesosPorRareza(pesos);
    }

    /** Peso del token, o 0 si el mercado de esta corrida no lo usa. */
    double peso(String token) {
        return pesos.getOrDefault(token, 0.0);
    }

    /** Suma de pesos de un conjunto; 0 si ninguno de sus tokens pesa. */
    double masa(Set<String> tokens) {
        if (tokens == null) return 0.0;
        double suma = 0.0;
        for (String token : tokens) {
            suma += peso(token);
        }
        return suma;
    }

    /**
     * Parecido entre dos conjuntos, de 0 a 1, o {@code null} si alguno no tiene
     * ni un token que el mercado use.
     *
     * <p>Es la media geometrica de cuanto cubre cada lado del otro. Simetrica a
     * proposito: la formula anterior dividia solo entre los tokens del
     * estudiante, asi que un perfil pobre —dos palabras, ambas coincidentes—
     * puntuaba 1.0 y uno detallado quedaba por debajo. Aqui cubrir todo lo que
     * pide la vacante con un perfil minusculo ya no basta, porque el otro
     * factor de la media sigue siendo bajo.
     */
    Double parecido(Set<String> unos, Set<String> otros) {
        double masaUnos = masa(unos);
        double masaOtros = masa(otros);
        if (masaUnos <= 0 || masaOtros <= 0) {
            return null;
        }
        double comun = 0.0;
        for (String token : unos) {
            if (otros.contains(token)) {
                comun += peso(token);
            }
        }
        if (comun <= 0) {
            return 0.0;
        }
        return Math.min(Math.sqrt((comun / masaUnos) * (comun / masaOtros)), 1.0);
    }
}
