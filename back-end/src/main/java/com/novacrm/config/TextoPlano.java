package com.novacrm.config;

import java.util.regex.Pattern;

/**
 * Version en texto plano de un correo HTML.
 *
 * <p>Existe por dos motivos, y el primero es el que importa. Un mensaje que
 * solo lleva HTML puntua peor en los filtros antispam de Gmail y Outlook: para
 * un envio masivo de enlaces de activacion, acabar en la carpeta de correo no
 * deseado equivale a no haberlo enviado. La forma estandar de evitarlo es
 * mandar {@code multipart/alternative} con las dos versiones.
 *
 * <p>El segundo es que hay quien lee el correo sin HTML —clientes de texto,
 * lectores de pantalla mal configurados, relojes—, y ahi un correo solo-HTML se
 * ve como una maranna de etiquetas o directamente vacio.
 *
 * <p>Se deriva del HTML en lugar de escribirse aparte a proposito: dos textos
 * que hay que mantener en paralelo se desincronizan, y el que nadie mira es
 * justamente el de texto plano.
 *
 * <p>Funcion pura, sin dependencias: se puede probar sin Spring.
 */
public final class TextoPlano {

    private TextoPlano() {}

    /** Elementos tras los que hace falta un salto de linea. */
    private static final Pattern SALTOS =
            Pattern.compile("(?i)</(p|div|tr|h1|h2|h3|li)>|<br\\s*/?>");

    private static final Pattern ETIQUETAS = Pattern.compile("<[^>]+>");

    /**
     * Bloques cuyo contenido no es texto visible. Se quitan enteros: dejar el
     * cuerpo de un {@code <style>} produciria reglas CSS en medio del mensaje.
     */
    private static final Pattern BLOQUES_INVISIBLES =
            Pattern.compile("(?is)<(script|style|head)\\b.*?</\\1>");

    /**
     * Lo que el HTML esconde tampoco debe salir en el texto. La plantilla lleva
     * un preheader oculto —el resumen que los clientes muestran junto al
     * asunto— con el mismo saludo que abre el mensaje; sin quitarlo, quien lee
     * en texto plano ve el saludo dos veces seguidas.
     */
    private static final Pattern OCULTOS = Pattern.compile(
            "(?is)<(div|span|p|td)\\b[^>]*style=[\"'][^\"']*display\\s*:\\s*none[^\"']*[\"'][^>]*>.*?</\\1>");

    /**
     * Un enlace se convierte en "texto (url)". Sin esto el destinatario ve
     * "Crear mi contrasena" sin nada donde pinchar, que en un correo de
     * activacion lo deja sin poder entrar.
     */
    private static final Pattern ENLACES =
            Pattern.compile("(?is)<a\\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>");

    private static final Pattern LINEAS_EN_BLANCO = Pattern.compile("\n{3,}");
    private static final Pattern ESPACIOS = Pattern.compile("[ \t ]+");

    public static String deHtml(String html) {
        if (html == null || html.isBlank()) {
            return "";
        }

        String texto = BLOQUES_INVISIBLES.matcher(html).replaceAll("");
        texto = OCULTOS.matcher(texto).replaceAll("");

        texto = ENLACES.matcher(texto).replaceAll(m -> {
            String etiqueta = ETIQUETAS.matcher(m.group(2)).replaceAll("").trim();
            String url = m.group(1);
            // Si el texto del enlace ya es la propia URL, repetirla sobra.
            return etiqueta.isEmpty() || etiqueta.equals(url)
                    ? url
                    : etiqueta + " (" + url + ")";
        });

        texto = SALTOS.matcher(texto).replaceAll("\n");
        texto = ETIQUETAS.matcher(texto).replaceAll("");
        texto = desescapar(texto);

        // Limpieza final: el HTML de correo va lleno de sangrias y saltos que
        // solo servian para que el fuente fuera legible.
        var limpio = new StringBuilder();
        for (String linea : texto.split("\n")) {
            String l = ESPACIOS.matcher(linea).replaceAll(" ").trim();
            limpio.append(l).append('\n');
        }

        return LINEAS_EN_BLANCO.matcher(limpio.toString()).replaceAll("\n\n").trim();
    }

    /**
     * Entidades que usa la plantilla. No se pretende cubrir HTML arbitrario:
     * el HTML de entrada lo genera {@link PlantillaCorreo}, no un tercero.
     * {@code &amp;} va al final para no reescribir lo ya sustituido.
     */
    private static String desescapar(String texto) {
        return texto
                .replace("&nbsp;", " ")
                .replace("&laquo;", "«")
                .replace("&raquo;", "»")
                .replace("&mdash;", "—")
                .replace("&ndash;", "–")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&amp;", "&");
    }
}
