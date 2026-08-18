package com.novacrm.scraper.fuente;

import com.novacrm.vacante.Vacante;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

/**
 * Decide si una oferta es de trabajo en ingles.
 *
 * <p>El programa forma para empleabilidad <strong>bilingue</strong>. Una plaza
 * que no exige ingles puede ser una oferta estupenda y aun asi no servirle a
 * esta poblacion: 71 de los 108 activos apuntan a BPO y casi todos escribieron
 * un cargo objetivo que empieza por «Bilingual». Buscar «bilingue» en los
 * portales acerca, pero no basta —un buscador que recibe «asesor bilingue»
 * devuelve tambien «asesor comercial»—, y sin este filtro el tablon se llena de
 * ofertas monolingues entre las que hay que ir a pescar las cinco que valen.
 *
 * <h2>Que cuenta como prueba, y que no</h2>
 *
 * <p>Solo cuenta la <strong>mencion explicita del idioma</strong>: «bilingue»,
 * «ingles», «english», un nivel del marco europeo. Deliberadamente <em>no</em>
 * cuentan dos cosas que tientan:
 *
 * <ul>
 *   <li><strong>El nombre de la empresa.</strong> Los grandes BPO del Atlantico
 *       contratan tambien para campanas en espanol; dar por bilingue todo lo que
 *       publica un contact center meteria justo el ruido que esto quita.
 *   <li><strong>El cargo en ingles.</strong> «Customer Service Agent» como
 *       titulo no dice nada del idioma de trabajo: los portales colombianos
 *       publican cargos en ingles para plazas enteramente en espanol.
 * </ul>
 *
 * <p>Y al reves: <strong>lo que ya nace en ingles no se examina</strong>. Una
 * fuente de segmento {@link Segmento#REMOTO_INGLES} publica en ingles para
 * empresas de fuera; pedirle ademas que diga «bilingue» seria descartarla toda.
 */
public final class FiltroBilingue {

    /**
     * La prueba: el texto habla del idioma.
     *
     * <p>Ya normalizado —sin tildes y en minusculas—, asi que «bilingüe»,
     * «Bilingüe» y «BILINGUE» caen en «bilingu».
     */
    private static final List<String> PRUEBAS_DE_IDIOMA = List.of(
            "bilingu",        // bilingue, bilingual, bilinguismo
            "ingles",
            "english",
            "idioma extranjero",
            "segundo idioma",
            "nivel de idioma",
            "b1", "b2", "c1", "c2");
    // «fluent» y «conversational» estuvieron aqui y se quitaron: solo pueden
    // decidir algo cuando la oferta no dice «english» ni «ingles» por ningun
    // lado, y justo entonces no prueban nada —«fluent written communication» es
    // una frase de cualquier anuncio en ingles—. Cuando acompañan al idioma
    // («conversational English») ya los cubre la prueba de la palabra suelta.
    // Dejarlos colaba ofertas en ingles que no piden ingles al candidato.

    /**
     * Niveles sueltos que dan falsos positivos si se buscan como fragmento.
     *
     * <p>«b2» aparece dentro de referencias de puesto y de codigos; se exige que
     * vaya rodeado de algo que lo haga un nivel de idioma. Sin esto, una oferta
     * de «operario zona B2» pasaba por bilingue.
     */
    private static final List<String> NIVELES = List.of("b1", "b2", "c1", "c2");

    private FiltroBilingue() {
    }

    /**
     * Si la oferta le sirve a un programa bilingue.
     *
     * <p>Mira titulo, descripcion, requisitos y el nivel de ingles que declare
     * la propia oferta. No mira la empresa, por lo dicho arriba.
     */
    public static boolean esDeTrabajoEnIngles(Vacante vacante) {
        if (vacante == null) {
            return false;
        }
        // Lo que ya viene en ingles por construccion no se examina.
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
        for (String prueba : PRUEBAS_DE_IDIOMA) {
            if (NIVELES.contains(prueba)) {
                if (esNivelDeIdioma(t, prueba)) {
                    return true;
                }
                continue;
            }
            if (t.contains(prueba)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Un «b2» solo vale si esta cerca de una palabra de idioma.
     *
     * <p>Se mira una ventana de treinta caracteres a cada lado y no la oferta
     * entera: en un texto largo casi siempre aparece «ingles» en alguna parte, y
     * entonces la comprobacion del nivel no estaria comprobando nada —bastaria
     * la palabra suelta, que ya la cubre la prueba anterior—.
     */
    private static boolean esNivelDeIdioma(String texto, String nivel) {
        int desde = 0;
        while (true) {
            int i = texto.indexOf(nivel, desde);
            if (i < 0) {
                return false;
            }
            // Con limite de palabra: «b2» dentro de «sub2» o «b25» no es nivel.
            boolean antesLimpio = i == 0 || !Character.isLetterOrDigit(texto.charAt(i - 1));
            int fin = i + nivel.length();
            boolean despuesLimpio = fin >= texto.length()
                    || !Character.isLetterOrDigit(texto.charAt(fin));
            if (antesLimpio && despuesLimpio) {
                String ventana = texto.substring(Math.max(0, i - 30),
                        Math.min(texto.length(), fin + 30));
                if (ventana.contains("ingl") || ventana.contains("english")
                        || ventana.contains("idioma") || ventana.contains("nivel")) {
                    return true;
                }
            }
            desde = i + 1;
        }
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
