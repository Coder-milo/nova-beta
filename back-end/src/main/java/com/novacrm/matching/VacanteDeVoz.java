package com.novacrm.matching;

import com.novacrm.vacante.Vacante;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

/**
 * Reconoce las vacantes cuyo trabajo es hablar con el cliente en ingles.
 *
 * <p>Importa porque es donde la poblacion del programa tiene la brecha: la
 * mayoria alcanza B1 escrito pero A1 oral. Una vacante de BPO de voz exige la
 * destreza justo mas floja, y puntuarla con el nivel general la deja pasar.
 *
 * <p>Es una heuristica sobre el texto del anuncio: no hay un campo que lo
 * declare. Ante la duda se responde que no es de voz, de modo que el efecto
 * sea exigir mas solo cuando hay senales claras.
 */
public final class VacanteDeVoz {

    /**
     * Terminos habituales en los anuncios de BPO de voz, en espanol e ingles.
     * Se comparan sobre el texto sin tildes y en minusculas.
     */
    private static final List<String> SENALES = List.of(
            "call center", "callcenter", "contact center",
            "customer service", "servicio al cliente", "atencion al cliente",
            "telemercadeo", "telemarketing", "televenta", "teleoperador",
            "agente bilingue", "bilingual agent", "voice", "de voz",
            "inbound", "outbound", "csr", "help desk", "mesa de ayuda",
            "soporte telefonico", "asesor telefonico");

    private VacanteDeVoz() {
    }

    public static boolean esDeVoz(Vacante vacante) {
        if (vacante == null) {
            return false;
        }
        String texto = normalizar(
                String.join(" ",
                        vacante.getTitulo() == null ? "" : vacante.getTitulo(),
                        vacante.getDescripcion() == null ? "" : vacante.getDescripcion(),
                        vacante.getRequisitos() == null ? "" : vacante.getRequisitos()));

        return SENALES.stream().anyMatch(texto::contains);
    }

    private static String normalizar(String texto) {
        return Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                .toLowerCase(Locale.ROOT);
    }
}
