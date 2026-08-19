package com.novacrm.scraper;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Decide que se busca en los portales de empleo.
 *
 * <p>Este programa es de <strong>empleabilidad bilingue</strong>: lo que forma
 * es gente que trabaje en ingles, y la salida natural en el Atlantico es el
 * BPO. Los datos de la cohorte lo dicen sin ambiguedad —71 de 108 declararon
 * «BPO / Servicios tercerizados» como sector, y casi todos los cargos objetivo
 * empiezan por «Bilingual»—. Una vacante que no exige ingles no le sirve a esta
 * poblacion aunque sea una oferta perfectamente buena.
 *
 * <p>De ahi las dos partes de esta clase:
 *
 * <ul>
 *   <li>Un <strong>nucleo fijo</strong> que se busca siempre. Es lo que hace
 *       que la corrida traiga BPO bilingue aunque las fichas esten a medio
 *       llenar o la cohorte cambie.
 *   <li>Lo que declararon los estudiantes, <strong>filtrado a lo bilingue y
 *       ordenado por frecuencia</strong>.
 * </ul>
 *
 * <p>Lo de la frecuencia no es un detalle: antes se tomaban los ocho primeros
 * valores de un {@code SELECT DISTINCT} sobre {@code cargoObjetivo}. Como cada
 * participante escribe el suyo, eran 108 cadenas distintas y los ocho primeros
 * salian en el orden que quisiera la base. La corrida podia acabar buscando
 * «bilingual special education teacher» —un caso— y no «bilingual customer
 * service agent», que es a lo que apunta media cohorte.
 */
public final class TerminosDeBusqueda {

    /**
     * Lo que se busca siempre, pase lo que pase con las fichas.
     *
     * <p>Van en espanol y en el orden en que rinden en los portales locales:
     * «bilingue» a secas es el termino con el que las empresas del Atlantico
     * publican estas plazas, mucho mas que cualquier cargo en ingles. Las
     * ofertas de Computrabajo y Elempleo estan escritas en espanol aunque el
     * trabajo sea en ingles.
     */
    static final List<String> NUCLEO_BILINGUE = List.of(
            "bilingue",
            "bilingual customer service",
            "call center bilingue",
            "asesor bilingue",
            "ingles b2",
            "bpo");

    /** Cuantos se reserva el nucleo. El resto sale de las fichas. */
    static final int RESERVADOS_AL_NUCLEO = NUCLEO_BILINGUE.size();

    /**
     * Se usan si no hay ni fichas ni nada que derivar.
     */
    static final List<String> RESPALDO = List.of(
            "bilingue",
            "bilingual customer service",
            "call center bilingue",
            "asesor bilingue",
            "ingles b2",
            "ingles c1",
            "bpo",
            "customer service bilingue",
            "soporte bilingue",
            "servicio al cliente bilingue");

    /** Tope por corrida: cada termino es una peticion mas al portal. */
    static final int MAX_TERMINOS = 10;

    /** Ciudad por defecto cuando no hay ninguna registrada. */
    static final String CIUDAD_POR_DEFECTO = "Colombia";

    /**
     * Marcas de que un texto habla de trabajo en ingles.
     *
     * <p>Se usa para elegir <em>terminos de busqueda</em>, no para decidir si
     * una oferta sirve; eso es mas estricto y vive en {@code FiltroBilingue}.
     * Aqui basta con que la pista apunte al mundo del BPO bilingue, porque el
     * peor caso es gastar una consulta.
     */
    private static final Set<String> PISTAS_DE_INGLES = Set.of(
            "bilingu",      // bilingue, bilingual, bilingüe ya normalizado
            "ingles",
            "english",
            "bpo",
            "call center",
            "contact center",
            "customer service",
            "customer experience",
            "customer success",
            "technical support",
            "back office",
            "help desk",
            "telesales",
            "chat support");

    private TerminosDeBusqueda() {
    }

    /**
     * Construye los terminos: primero el nucleo, despues lo de las fichas.
     *
     * @param cargosObjetivo   valores de {@code cargoObjetivo}, uno por ficha
     * @param sectoresObjetivo valores de {@code sectorObjetivo}, uno por ficha
     */
    public static List<String> desdeEstudiantes(List<String> cargosObjetivo,
                                                List<String> sectoresObjetivo) {
        // El cargo es mas especifico que el sector, asi que pesa primero. Los
        // dos se cuentan juntos para que un cargo que aparece dos veces gane a
        // un sector que aparece una.
        var derivados = porFrecuencia(cargosObjetivo, sectoresObjetivo);

        // Sin nada que derivar se usa el respaldo entero y no solo el nucleo:
        // si no hay fichas de las que aprender, conviene abrir un poco mas la
        // busqueda dentro de lo bilingue en vez de repetir cuatro terminos.
        if (derivados.isEmpty()) {
            return RESPALDO;
        }

        Set<String> terminos = new LinkedHashSet<>(NUCLEO_BILINGUE);
        for (String termino : derivados) {
            if (terminos.size() >= MAX_TERMINOS) {
                break;
            }
            terminos.add(termino);
        }
        return List.copyOf(terminos);
    }

    /**
     * Los trozos que mas se repiten entre las fichas, solo los bilingues.
     *
     * <p>Se cuenta despues de trocear y limpiar, no sobre la cadena entera: las
     * cadenas enteras son unicas —cada participante escribe la suya— y contar
     * ahi daria uno para todo. Troceada, «Bilingual Customer Service Agent /
     * Telesales Representative» aporta dos trozos que si coinciden con los de
     * otras fichas.
     */
    static List<String> porFrecuencia(List<String> cargos, List<String> sectores) {
        Map<String, Integer> cuenta = new LinkedHashMap<>();
        contar(cuenta, cargos);
        contar(cuenta, sectores);

        return cuenta.entrySet().stream()
                .filter(e -> hablaDeIngles(e.getKey()))
                // Mas frecuente primero; a igualdad, el orden en que se vio.
                // Estable a proposito: dos corridas seguidas sobre la misma
                // cohorte tienen que buscar lo mismo, o no hay forma de saber
                // si un portal dejo de responder o es que se le pidio otra cosa.
                .sorted(Map.Entry.<String, Integer>comparingByValue(Comparator.reverseOrder()))
                .map(Map.Entry::getKey)
                .toList();
    }

    private static void contar(Map<String, Integer> cuenta, List<String> valores) {
        if (valores == null) {
            return;
        }
        for (String valor : valores) {
            for (String termino : trocear(valor)) {
                cuenta.merge(termino, 1, Integer::sum);
            }
        }
    }

    /** Si el texto —ya normalizado— apunta a trabajo en ingles o a BPO. */
    static boolean hablaDeIngles(String textoNormalizado) {
        if (textoNormalizado == null || textoNormalizado.isBlank()) {
            return false;
        }
        String t = textoNormalizado.toLowerCase(Locale.ROOT);
        return PISTAS_DE_INGLES.stream().anyMatch(t::contains);
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
