package com.novacrm.matching;

import java.util.Set;

/**
 * Reconoce las vacantes cuyo trabajo es hablar con el cliente en ingles.
 *
 * <p>Importa porque es donde la poblacion del programa tiene la brecha: la
 * mayoria alcanza B1 escrito pero A1 oral. Una vacante de BPO de voz exige la
 * destreza justo mas floja, y puntuarla con el nivel general la deja pasar.
 *
 * <p>Es una heuristica sobre el texto del anuncio: no hay un campo que lo
 * declare. Ante la duda se responde que no es de voz, de modo que el efecto sea
 * exigir mas solo cuando hay senales claras.
 *
 * <p>Las senales vivian aqui, en una lista de Java paralela a
 * {@code matching-synonyms.yml} que ademas contenia justo el vocabulario de BPO
 * que al yml le faltaba. Ahora salen del yml, con dos consecuencias: ampliarlo
 * mejora el matching y la deteccion de voz a la vez, y la comparacion es por
 * token y no por {@code contains} sobre el texto crudo —que hacia que "voice"
 * coincidiera dentro de "invoice"—.
 */
public final class VacanteDeVoz {

    /**
     * Grupos canonicos cuyo oficio implica atender por voz.
     *
     * <p>{@code bpo} queda fuera a proposito: nombra el modelo de negocio, no
     * el puesto, y un BPO tiene tantas plazas de back office como de telefono.
     */
    static final Set<String> CANONICOS_DE_VOZ =
            Set.of("call_center", "servicio_cliente", "trabajo_de_voz");

    private VacanteDeVoz() {
    }

    /**
     * @param tokensVacante tokens del titulo, la descripcion y los requisitos,
     *                      ya normalizados por {@link SkillSynonyms}
     */
    public static boolean esDeVoz(Set<String> tokensVacante) {
        return tokensVacante != null && tokensVacante.stream().anyMatch(CANONICOS_DE_VOZ::contains);
    }
}
