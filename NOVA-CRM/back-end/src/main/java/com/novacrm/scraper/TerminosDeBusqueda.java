package com.novacrm.scraper;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Decide que se busca en los portales de empleo.
 *
 * <p>Antes eran cinco palabras fijas —"desarrollador", "ingeniero",
 * "analista", "practicante", "tecnologo"— y la ciudad "Bogota". No es lo que
 * busca esta poblacion: la mayoria de participantes apunta a BPO y servicio al
 * cliente bilingue, y reside en la costa. El scraper traia ofertas que nadie
 * podia aprovechar.
 *
 * <p>Ahora los terminos salen del cargo y el sector que declararon los propios
 * estudiantes, con un respaldo fijo por si la base todavia esta vacia.
 */
public final class TerminosDeBusqueda {

    /** Se usan si aun no hay estudiantes cargados. */
    static final List<String> RESPALDO = List.of(
            "servicio al cliente bilingue",
            "customer service bilingual",
            "agente call center",
            "asesor comercial",
            "auxiliar administrativo");

    /** Tope por corrida: cada termino es una peticion mas al portal. */
    static final int MAX_TERMINOS = 8;

    /** Ciudad por defecto cuando no hay ninguna registrada. */
    static final String CIUDAD_POR_DEFECTO = "Colombia";

    private TerminosDeBusqueda() {
    }

    /**
     * Construye los terminos a partir de lo que declararon los estudiantes.
     *
     * @param cargosObjetivo   valores de {@code cargoObjetivo}
     * @param sectoresObjetivo valores de {@code sectorObjetivo}
     */
    public static List<String> desdeEstudiantes(List<String> cargosObjetivo,
                                                List<String> sectoresObjetivo) {
        Set<String> terminos = new LinkedHashSet<>();

        // El cargo es mas especifico que el sector, asi que va primero.
        anadirNormalizados(terminos, cargosObjetivo);
        anadirNormalizados(terminos, sectoresObjetivo);

        if (terminos.isEmpty()) {
            return RESPALDO;
        }
        return terminos.stream().limit(MAX_TERMINOS).toList();
    }

    private static void anadirNormalizados(Set<String> destino, List<String> valores) {
        if (valores == null) {
            return;
        }
        for (String valor : valores) {
            for (String termino : trocear(valor)) {
                if (destino.size() >= MAX_TERMINOS) {
                    return;
                }
                destino.add(termino);
            }
        }
    }

    /**
     * Un mismo campo suele traer varias opciones ("BPO / Servicios
     * tercerizados", "Customer Service Representative / Sales Agent"). Cada
     * parte es un termino de busqueda distinto.
     */
    static List<String> trocear(String valor) {
        List<String> resultado = new ArrayList<>();
        if (valor == null || valor.isBlank()) {
            return resultado;
        }
        for (String parte : valor.split("[/|,;]|\\by\\b")) {
            String limpio = limpiar(parte);
            // Menos de cuatro letras da busquedas inservibles ("BPO" pasa, "de" no).
            if (limpio.length() >= 3 && !limpio.isBlank()) {
                resultado.add(limpio);
            }
        }
        return resultado;
    }

    private static String limpiar(String texto) {
        String limpio = Normalizer.normalize(texto.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                .replaceAll("[^\\p{Alnum}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase(Locale.ROOT);
        // Los portales devuelven poco con frases largas.
        String[] palabras = limpio.split(" ");
        if (palabras.length > 4) {
            limpio = String.join(" ", java.util.Arrays.copyOfRange(palabras, 0, 4));
        }
        return limpio;
    }

    /** Ciudades donde hay estudiantes; si no hay ninguna, busqueda nacional. */
    public static List<String> ciudades(List<String> ciudadesEstudiantes) {
        if (ciudadesEstudiantes == null || ciudadesEstudiantes.isEmpty()) {
            return List.of(CIUDAD_POR_DEFECTO);
        }
        return ciudadesEstudiantes.stream()
                .filter(c -> c != null && !c.isBlank())
                .map(String::trim)
                .distinct()
                .limit(5)
                .toList();
    }
}
