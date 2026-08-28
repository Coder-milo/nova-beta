package com.novacrm.scraper.fuente;

import com.novacrm.vacante.Vacante;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Decide con rigor estricto si una oferta de empleo exige dominio del idioma inglés
 * (perfil bilingüe multidisciplinar) o si debe ser 100% descartada.
 *
 * <p>El programa forma para empleabilidad <strong>bilingüe</strong> en diversas disciplinas
 * (Ingenierías, Software/Tech, Finanzas, Negocios, Diseño Gráfico, Marketing, Operaciones,
 * Soporte/BPO, etc.). Una plaza que no exige inglés no le sirve a los participantes.
 *
 * <h2>Qué cuenta como prueba, y qué no</h2>
 * <ul>
 *   <li><strong>100% Gatekeeper:</strong> Las ofertas locales en español que no exijan inglés
 *       son 100% rechazadas.</li>
 *   <li><strong>Remoto en Inglés:</strong> Las ofertas con segmento {@link Segmento#REMOTO_INGLES}
 *       pasan automáticamente, pues nacen en inglés para el mercado internacional.</li>
 *   <li><strong>Nivel Explícito Previo:</strong> Si la vacante ya tiene {@code nivelInglesRequerido}
 *       declarado, pasa automáticamente.</li>
 *   <li><strong>Mención Explícita Multidisciplinar:</strong> Detecta menciones explícitas de idioma
 *       («bilingüe», «inglés», «english»), niveles MCER/CEFR («B1», «B2», «C1», «C2», «B1+», «B2+»,
 *       «C1+», «B1/B2», «B2/C1»), y variaciones de fraseo («inglés avanzado», «inglés intermedio»,
 *       «inglés conversacional», «inglés fluido», «inglés técnico», «dominio de inglés», «manejo de inglés»,
 *       «100% bilingüe», «totalmente bilingüe», «fluent in english», «working english», «english proficiency»).</li>
 *   <li><strong>Protección contra Falsos Positivos:</strong> Neutraliza acrónimos comerciales
 *       («B2B», «B2C», «B2G», «2B»), licencias de conducción («Licencia C1», «Pase B2»), ubicaciones
 *       físicas («Zona B2», «Bodega B1», «Piso B2», «Pasillo B1»), vitaminas («Vitamina B1») y
 *       cargos en inglés para plazas en español sin requisito de idioma.</li>
 * </ul>
 */
public final class FiltroBilingue {

    /**
     * Raíces y expresiones que de forma inequívoca indican exigencia de idioma extranjero o inglés.
     */
    private static final List<String> RAICES_IDIOMA = List.of(
            "bilingu",           // bilingue, bilingüe, bilingual, bilinguismo, bilingualism, 100% bilingue
            "trilingu",          // trilingue, trilingual
            "ingles",            // ingles, inglés
            "english",           // english
            "idioma extranjero",
            "idiomas extranjeros",
            "segundo idioma",
            "lengua extranjera",
            "lenguas extranjeras",
            "lengua inglesa"
    );

    /**
     * Patrón de marco europeo explícito (MCER / CEFR / Marco común europeo / Nivel de idioma).
     * Ejemplos: "MCER B2", "CEFR C1", "MCER-B2", "CEFR: B2+", "Marco Comun Europeo B2".
     */
    private static final Pattern PATRON_MARCO_EUROPEO = Pattern.compile(
            "\\b(?:mcer|cefr|marco\\s+(?:comun\\s+)?europeo)\\s*[:\\-–—]?\\s*(?:nivel\\s*)?([abc][12](?:\\s*\\+|\\s*\\-|\\s*[\\/\\-]\\s*[abc][12])?)\\b"
    );

    /**
     * Patrón de nivel explícito ("nivel B2", "level C1", "nivel: B2+", "level B1/B2").
     */
    private static final Pattern PATRON_NIVEL_EXPLICITO = Pattern.compile(
            "\\b(?:nivel|level)\\s*[:\\-–—]?\\s*([abc][12](?:\\s*\\+|\\s*\\-|\\s*[\\/\\-]\\s*[abc][12])?)\\b"
    );

    /**
     * Patrón de nivel sufijo ("B2 level", "C1 level", "B2 nivel", "C1 nivel").
     */
    private static final Pattern PATRON_NIVEL_SUFIJO = Pattern.compile(
            "\\b([abc][12](?:\\s*\\+|\\s*\\-|\\s*[\\/\\-]\\s*[abc][12])?)\\s*(?:level|nivel)\\b"
    );

    /**
     * Patrón de rangos de nivel MCER compuestos ("B1/B2", "B2/C1", "C1/C2", "B1-B2", "B2-C1", "B1 a B2", "B2 a C1").
     */
    private static final Pattern PATRON_RANGO_NIVELES = Pattern.compile(
            "\\b([abc][12])\\s*(?:[\\/\\-]|a|o|to)\\s*([abc][12])\\b"
    );

    /**
     * Niveles estándar evaluados individualmente.
     */
    private static final List<String> NIVELES_INDIVIDUALES = List.of("b1", "b2", "c1", "c2");

    /**
     * Prefijos o contextos negativos que invalidan un código alfanumérico como nivel de idioma.
     */
    private static final List<String> PREFIJOS_NEGATIVOS = List.of(
            // Lugares e infraestructura
            "zona", "bodega", "piso", "pasillo", "sector", "modulo", "bloque",
            "torre", "manzana", "puerta", "sotano", "anden", "parqueadero",
            "local", "stand", "planta", "sede", "estante",
            // Licencias de conducción (Colombia categorías B1, B2, C1, C2, C3)
            "licencia", "pase", "conduccion", "conducir", "categoria", "chofer", "conductor",
            // Vitaminas y medicina
            "vitamina", "complejo",
            // Formatos y papel
            "formato", "tamano", "tamano de papel"
    );

    /**
     * Acrónimos comerciales no idiomáticos.
     */
    private static final Pattern PATRON_ACRONIMOS_NEGATIVOS = Pattern.compile(
            "\\b(?:b2b|b2c|b2g|b2e|c2c|2b|2c)\\b"
    );

    private FiltroBilingue() {
    }

    /**
     * Evalúa si la oferta le sirve al programa bilingüe multidisciplinar.
     *
     * @param vacante vacante a validar
     * @return {@code true} si exige inglés o es remota global; {@code false} en caso contrario.
     */
    public static boolean esDeTrabajoEnIngles(Vacante vacante) {
        if (vacante == null) {
            return false;
        }
        // Lo que ya viene en inglés por construcción (fuentes remotas) no se examina.
        if (vacante.getSegmento() == Segmento.REMOTO_INGLES) {
            return true;
        }
        if (vacante.getNivelInglesRequerido() != null
                && !vacante.getNivelInglesRequerido().isBlank()) {
            return true;
        }
        return mencionaElIdioma(vacante.getTitulo())
                || mencionaElIdioma(vacante.getDescripcion())
                || mencionaElIdioma(vacante.getRequisitos());
    }

    /** Si un texto suelto menciona el idioma. Visible para las pruebas. */
    static boolean mencionaElIdioma(String texto) {
        String t = normalizar(texto);
        if (t.isBlank()) {
            return false;
        }

        // 1. Raíces directas e inequívocas de idioma
        for (String raiz : RAICES_IDIOMA) {
            if (t.contains(raiz)) {
                return true;
            }
        }

        // 2. Patrones de marco europeo explícito (MCER / CEFR / Nivel B2)
        if (PATRON_MARCO_EUROPEO.matcher(t).find()) {
            return true;
        }
        Matcher mSufijo = PATRON_NIVEL_SUFIJO.matcher(t);
        while (mSufijo.find()) {
            if (esNivelValidoSinFalsoPositivo(t, mSufijo.start(), mSufijo.end(), mSufijo.group(1).trim())) {
                return true;
            }
        }
        Matcher mExp = PATRON_NIVEL_EXPLICITO.matcher(t);
        while (mExp.find()) {
            if (esNivelValidoSinFalsoPositivo(t, mExp.start(), mExp.end(), mExp.group(1).trim())) {
                return true;
            }
        }

        // 3. Rangos de niveles compuestos (ej. B1/B2, B2/C1)
        Matcher mRango = PATRON_RANGO_NIVELES.matcher(t);
        while (mRango.find()) {
            if (esNivelValidoSinFalsoPositivo(t, mRango.start(), mRango.end(), mRango.group().trim())) {
                return true;
            }
        }

        // 4. Niveles individuales con filtro de falso positivo y contexto
        for (String nivel : NIVELES_INDIVIDUALES) {
            if (evaluarNivelIndividual(t, nivel)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Un nivel individual (B1, B2, C1, C2) solo cuenta si no es falso positivo y tiene contexto idiomático.
     */
    private static boolean evaluarNivelIndividual(String texto, String nivel) {
        int desde = 0;
        while (true) {
            int i = texto.indexOf(nivel, desde);
            if (i < 0) {
                return false;
            }
            int fin = i + nivel.length();

            // Con límite de palabra: «b2» dentro de «sub2» o «b25» no es nivel.
            boolean antesLimpio = i == 0 || !Character.isLetterOrDigit(texto.charAt(i - 1));
            boolean despuesLimpio = fin >= texto.length() || !Character.isLetterOrDigit(texto.charAt(fin));

            if (antesLimpio && despuesLimpio) {
                if (esNivelValidoSinFalsoPositivo(texto, i, fin, nivel)) {
                    String ventana = texto.substring(Math.max(0, i - 40), Math.min(texto.length(), fin + 40));
                    if (tieneContextoDeIdioma(ventana)) {
                        return true;
                    }
                }
            }
            desde = i + 1;
        }
    }

    private static boolean esNivelValidoSinFalsoPositivo(String texto, int inicio, int fin, String tokenNivel) {
        String fragmento = texto.substring(Math.max(0, inicio - 2), Math.min(texto.length(), fin + 2));
        if (PATRON_ACRONIMOS_NEGATIVOS.matcher(fragmento).find()) {
            return false;
        }

        int inicioPrefijo = Math.max(0, inicio - 35);
        String prefijo = texto.substring(inicioPrefijo, inicio).trim();

        for (String neg : PREFIJOS_NEGATIVOS) {
            if (prefijo.endsWith(neg) || prefijo.matches(".*\\b" + neg + "\\b.*")) {
                return false;
            }
        }

        return true;
    }

    private static boolean tieneContextoDeIdioma(String ventana) {
        return ventana.contains("ingl")
                || ventana.contains("english")
                || ventana.contains("idioma")
                || ventana.contains("mcer")
                || ventana.contains("cefr")
                || ventana.contains("lengua")
                || ventana.contains("language")
                || ventana.contains("bilingu")
                || ventana.contains("trilingu")
                || ventana.contains("conversacional")
                || ventana.contains("conversational")
                || ventana.contains("fluido")
                || ventana.contains("fluent")
                || ventana.contains("tecnico")
                || ventana.contains("technical");
    }

    private static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        return Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                .toLowerCase(Locale.ROOT);
    }
}
