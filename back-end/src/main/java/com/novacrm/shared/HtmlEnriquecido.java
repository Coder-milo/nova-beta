package com.novacrm.shared;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.safety.Safelist;

import java.util.Set;

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
     * Propiedades CSS que el editor puede emitir. Cualquier otra —posicion,
     * superposicion, fondos fijos, imágenes remotas— se descarta: {@code url()}
     * dentro de un estilo convertiría el anuncio en un rastreador y
     * {@code position:fixed} en una superposición sobre el portal.
     */
    private static final Set<String> PROPIEDADES_CSS = Set.of(
            "color", "background-color", "text-align",
            "font-family", "font-size", "font-weight", "font-style", "text-decoration",
            "width", "height", "max-width", "max-height");

    private static final int MAX_LONGITUD_STYLE = 500;

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
                : limpiarEstilos(limpio);
    }

    /** Recorta cada atributo {@code style} a las propiedades permitidas. */
    private static String limpiarEstilos(String html) {
        Document doc = Jsoup.parse(html);
        doc.select("[style]").forEach(el -> {
            String estilo = el.attr("style");
            if (estilo == null || estilo.isBlank()) {
                el.removeAttr("style");
                return;
            }
            StringBuilder limpio = new StringBuilder();
            for (String declaracion : estilo.split(";")) {
                int dosPuntos = declaracion.indexOf(':');
                if (dosPuntos < 0) continue;
                String propiedad = declaracion.substring(0, dosPuntos).trim().toLowerCase();
                String valor = declaracion.substring(dosPuntos + 1).trim();
                if (PROPIEDADES_CSS.contains(propiedad)
                        && !valor.isEmpty()
                        && !valor.contains("url(")
                        && limpio.length() + declaracion.length() <= MAX_LONGITUD_STYLE) {
                    limpio.append(propiedad).append(':').append(valor).append(';');
                }
            }
            if (limpio.isEmpty()) el.removeAttr("style");
            else el.attr("style", limpio.toString());
        });
        return doc.body().html();
    }
}
