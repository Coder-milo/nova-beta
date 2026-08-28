package com.novacrm.scraper;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Generador dinámico y multidisciplinar de términos de búsqueda enriquecidos para vacantes bilingües.
 *
 * <p>Extrae dinámicamente los perfiles de los estudiantes registrados a través de sus
 * diversas carreras, títulos, cargos y programas académicos (Tecnología, Datos,
 * Finanzas, Negocios, Ingenierías, Diseño, Marketing, Soporte/BPO), enriqueciéndolos
 * automáticamente con sufijos y operadores de búsqueda bilingüe adaptados a los portales
 * de empleo.
 */
public final class TerminosDeBusqueda {

    /** Tope por corrida: cada término es una petición más al portal. */
    public static final int MAX_TERMINOS = 10;

    /** Ciudad por defecto cuando no hay ninguna registrada. */
    public static final String CIUDAD_POR_DEFECTO = "Colombia";

    /**
     * Núcleo balanceado y multidisciplinar de respaldo.
     * Cubre Tech, Datos, Negocios/Finanzas, Ingenierías, Diseño, Marketing y Soporte/BPO.
     */
    public static final List<String> RESPALDO = List.of(
            "bilingue",
            "desarrollador bilingue",
            "software engineer bilingual",
            "analista datos bilingue",
            "contador bilingue",
            "ingeniero bilingue",
            "disenador bilingue",
            "marketing bilingue",
            "bilingual customer service",
            "soporte bilingue");

    /** Alias por retrocompatibilidad */
    public static final List<String> NUCLEO_BILINGUE = RESPALDO;

    /** Cuantos se reserva el nucleo (retrocompatibilidad). */
    static final int RESERVADOS_AL_NUCLEO = NUCLEO_BILINGUE.size();

    /**
     * Marcas de que un término ya contiene un modificador de idioma o búsqueda bilingüe.
     */
    private static final Set<String> MARCAS_BILINGUES = Set.of(
            "bilingu",      // bilingue, bilingual, bilingüe
            "ingles",       // ingles, inglés
            "english",      // english
            "bpo",          // bpo
            "c1",
            "b2"
    );

    private static final String REGEX_DELIMITADORES = "[/|,;&\\n\\r]|\\b(y|e|and)\\b";

    private TerminosDeBusqueda() {
    }

    /**
     * Construye los términos combinando colecciones arbitrarias de campos de estudiantes.
     */
    @SafeVarargs
    public static List<String> desdeEstudiantes(List<String>... coleccionesValores) {
        if (coleccionesValores == null || coleccionesValores.length == 0) {
            return RESPALDO;
        }
        return desdeColecciones(Arrays.asList(coleccionesValores));
    }

    /** Retrocompatibilidad (2 parámetros: cargos y sectores) */
    public static List<String> desdeEstudiantes(List<String> cargosObjetivo,
                                                List<String> sectoresObjetivo) {
        if (cargosObjetivo == null && sectoresObjetivo == null) {
            return RESPALDO;
        }
        List<List<String>> listas = new ArrayList<>();
        if (cargosObjetivo != null) listas.add(cargosObjetivo);
        if (sectoresObjetivo != null) listas.add(sectoresObjetivo);
        return desdeColecciones(listas);
    }

    /** Ingesta completa de 5 campos académicos y profesionales */
    public static List<String> desdeEstudiantes(List<String> cargosObjetivo,
                                                List<String> sectoresObjetivo,
                                                List<String> titulos,
                                                List<String> programasAcademicos,
                                                List<String> areasFormacion) {
        if (cargosObjetivo == null && sectoresObjetivo == null && titulos == null
                && programasAcademicos == null && areasFormacion == null) {
            return RESPALDO;
        }
        List<List<String>> listas = new ArrayList<>();
        if (cargosObjetivo != null) listas.add(cargosObjetivo);
        if (sectoresObjetivo != null) listas.add(sectoresObjetivo);
        if (titulos != null) listas.add(titulos);
        if (programasAcademicos != null) listas.add(programasAcademicos);
        if (areasFormacion != null) listas.add(areasFormacion);
        return desdeColecciones(listas);
    }

    public static List<String> generar(List<String> textosCandidatos, List<String> sectores) {
        return desdeEstudiantes(textosCandidatos, sectores);
    }

    private static List<String> desdeColecciones(List<List<String>> colecciones) {
        var derivados = porFrecuenciaColecciones(colecciones);

        if (derivados.isEmpty()) {
            return RESPALDO;
        }

        Set<String> terminos = new LinkedHashSet<>();
        for (String termino : derivados) {
            if (terminos.size() >= MAX_TERMINOS) {
                break;
            }
            terminos.add(termino);
        }

        // Si los derivados de los estudiantes son menos de MAX_TERMINOS,
        // completamos con el núcleo multidisciplinar para aprovechar la cuota
        if (terminos.size() < MAX_TERMINOS) {
            for (String respaldo : RESPALDO) {
                if (terminos.size() >= MAX_TERMINOS) {
                    break;
                }
                terminos.add(respaldo);
            }
        }

        return List.copyOf(terminos);
    }

    @SafeVarargs
    public static List<String> porFrecuencia(List<String>... colecciones) {
        if (colecciones == null || colecciones.length == 0) {
            return List.of();
        }
        return porFrecuenciaColecciones(Arrays.asList(colecciones));
    }

    public static List<String> porFrecuencia(List<String> cargos, List<String> sectores) {
        List<List<String>> listas = new ArrayList<>();
        if (cargos != null) listas.add(cargos);
        if (sectores != null) listas.add(sectores);
        return porFrecuenciaColecciones(listas);
    }

    private static List<String> porFrecuenciaColecciones(List<List<String>> colecciones) {
        Map<String, Integer> cuenta = new LinkedHashMap<>();
        if (colecciones != null) {
            for (List<String> valores : colecciones) {
                contar(cuenta, valores);
            }
        }

        Map<String, Integer> cuentaEnriquecida = new LinkedHashMap<>();
        for (Map.Entry<String, Integer> entry : cuenta.entrySet()) {
            String terminoBase = entry.getKey();
            int freq = entry.getValue();
            String enriquecido = enriquecerTermino(terminoBase);
            if (enriquecido != null && !enriquecido.isBlank()) {
                cuentaEnriquecida.merge(enriquecido, freq, Integer::sum);
            }
        }

        return cuentaEnriquecida.entrySet().stream()
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

    public static String enriquecerTermino(String terminoLimpio) {
        if (terminoLimpio == null || terminoLimpio.isBlank()) {
            return null;
        }

        if (tieneMarcaBilingue(terminoLimpio)) {
            return recortarPalabras(terminoLimpio, 4);
        }

        String t = terminoLimpio.toLowerCase(Locale.ROOT);
        if (esRolIngles(t)) {
            String base = recortarPalabras(terminoLimpio, 3);
            return "bilingual " + base;
        }

        String base = recortarPalabras(terminoLimpio, 3);
        return base + " bilingue";
    }

    private static boolean esRolIngles(String texto) {
        return texto.contains("developer")
                || texto.contains("engineer")
                || texto.contains("designer")
                || texto.contains("manager")
                || texto.contains("analyst")
                || texto.contains("scientist")
                || texto.contains("architect")
                || texto.contains("specialist")
                || texto.contains("full stack")
                || texto.contains("frontend")
                || texto.contains("backend")
                || texto.contains("devops")
                || texto.contains("qa");
    }

    public static boolean tieneMarcaBilingue(String textoNormalizado) {
        if (textoNormalizado == null || textoNormalizado.isBlank()) {
            return false;
        }
        String t = textoNormalizado.toLowerCase(Locale.ROOT);
        return MARCAS_BILINGUES.stream().anyMatch(t::contains);
    }

    static boolean hablaDeIngles(String textoNormalizado) {
        return tieneMarcaBilingue(textoNormalizado);
    }

    public static List<String> trocear(String valor) {
        List<String> resultado = new ArrayList<>();
        if (valor == null || valor.isBlank()) {
            return resultado;
        }
        for (String parte : valor.split(REGEX_DELIMITADORES)) {
            String limpio = limpiar(parte);
            if (limpio.length() >= 3 && !limpio.isBlank()) {
                resultado.add(limpio);
            }
        }
        return resultado;
    }

    public static String limpiar(String texto) {
        if (texto == null) {
            return "";
        }
        String limpio = Normalizer.normalize(texto.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                .replaceAll("[^\\p{Alnum}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase(Locale.ROOT);
        return recortarPalabras(limpio, 4);
    }

    public static String recortarPalabras(String texto, int maxPalabras) {
        if (texto == null || texto.isBlank()) {
            return "";
        }
        String[] palabras = texto.trim().split("\\s+");
        if (palabras.length <= maxPalabras) {
            return texto.trim();
        }
        return String.join(" ", java.util.Arrays.copyOfRange(palabras, 0, maxPalabras));
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
