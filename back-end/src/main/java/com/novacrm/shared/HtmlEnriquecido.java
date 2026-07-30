package com.novacrm.shared;

import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;

/**
 * Limpieza del HTML que llega de un editor enriquecido.
 *
 * <p>Los anuncios se redactan con formato —negritas, listas, enlaces, imágenes
 * incrustadas— y ese HTML acaba pintándose en el portal del estudiante. Aunque
 * quien escribe es personal de coordinación, el texto viaja por la API y se
 * guarda tal cual: sin filtrar, un {@code <script>} pegado sin querer desde
 * Word (o inyectado con la sesión de un coordinador) se ejecutaría en el
 * navegador de cada estudiante que abra la notificación.
 *
 * <p>La lista blanca es la de {@code Safelist.relaxed} más lo que el editor
 * produce y aquella no contempla: alineación por estilo, tamaños y familias
 * tipográficas, iframes de video y bloques de código.
 */
public final class HtmlEnriquecido {

    private static final Safelist PERMITIDO = Safelist.relaxed()
            .addTags("hr", "span", "figure", "figcaption", "iframe", "pre", "s", "u")
            .addAttributes("span", "style", "class")
            .addAttributes("p", "style", "class")
            .addAttributes("div", "style", "class")
            .addAttributes("li", "style", "class")
            .addAttributes("ol", "style", "class")
            .addAttributes("ul", "style", "class")
            .addAttributes("h1", "style").addAttributes("h2", "style").addAttributes("h3", "style")
            .addAttributes("pre", "class")
            .addAttributes("img", "style", "width", "height")
            .addAttributes("a", "target", "rel")
            .addAttributes("iframe", "src", "width", "height", "allow", "allowfullscreen", "frameborder")
            // Los videos incrustados por el editor son embeds de plataformas
            // conocidas. Permitir un iframe hacia cualquier host convertiría el
            // anuncio en un marco para páginas de terceros.
            .addProtocols("iframe", "src", "https")
            .addProtocols("img", "src", "http", "https", "data")
            .addProtocols("a", "href", "http", "https", "mailto");

    private HtmlEnriquecido() {}

    /**
     * Devuelve el HTML sin etiquetas ni atributos peligrosos.
     *
     * @return cadena vacía si tras limpiar no queda texto ni contenido visible
     */
    public static String limpiar(String html) {
        if (html == null || html.isBlank()) return "";
        String limpio = Jsoup.clean(html, "", PERMITIDO);
        // Un cuerpo que solo traía marcado prohibido queda en blanco: mejor
        // devolverlo vacío que guardar "<p></p>" y que la validación de
        // obligatoriedad lo dé por bueno.
        return Jsoup.parse(limpio).text().isBlank() && !limpio.contains("<img") && !limpio.contains("<iframe")
                ? ""
                : limpio;
    }
}
