package com.novacrm.config;

/**
 * Plantilla HTML de los correos del programa "Cuando sabes ingles se nota".
 *
 * <p>Estructura: logo de la Ruta Accelerator sobre fondo blanco, contenido, y
 * el banner institucional al pie —el que lleva los logos de la Fundacion Santo
 * Domingo, GitLab Foundation, CAC Eurocentres y Compartamos con Colombia.
 *
 * <p>Se arma con tablas y estilos en linea a proposito: los clientes de correo
 * —Outlook sobre todo— ignoran las hojas de estilo y buena parte de CSS
 * moderno, asi que flexbox o grid se romperian.
 *
 * <p>Las imagenes van por URL publica. Los clientes bloquean las imagenes hasta
 * que el destinatario las autoriza, asi que cada una lleva {@code alt} y el
 * mensaje se entiende sin ellas.
 */
public final class PlantillaCorreo {

    // Colores de la identidad grafica del programa.
    private static final String AZUL = "#1B6DF5";
    private static final String OSCURO = "#1F2A44";
    private static final String TEXTO = "#2B3348";
    private static final String GRIS_SUAVE = "#6B7280";

    private PlantillaCorreo() {
    }

    /**
     * Envuelve el contenido con la marca global.
     *
     * @param titulo     encabezado del mensaje
     * @param saludo     linea de saludo personalizada
     * @param cuerpoHtml contenido ya en HTML
     * @param urlLogo    logo de la Ruta Accelerator (cabecera)
     * @param urlBanner  banner institucional con los aliados (pie)
     */
    public static String construir(String titulo, String saludo, String cuerpoHtml,
                                   String urlLogo, String urlBanner) {
        return construir(titulo, saludo, cuerpoHtml, MarcaCorreo.global(urlLogo, urlBanner));
    }

    /**
     * Envuelve el contenido con la marca de un programa concreto.
     *
     * <p>Cada programa puede traer su propia cabecera, su propio pie y su propio
     * color; lo que no trae se resuelve con el valor institucional, de modo que
     * un programa a medio configurar sigue mandando un correo presentable.
     */
    public static String construir(String titulo, String saludo, String cuerpoHtml,
                                   MarcaCorreo marca) {
        String colorAcento = marca.colorPrimario() == null || marca.colorPrimario().isBlank()
                ? AZUL
                : marca.colorPrimario();
        return """
                <!DOCTYPE html>
                <html lang="es">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>%1$s</title>
                </head>
                <body style="margin:0;padding:0;background-color:#EEF1F6;">
                  <!-- Resumen que muestran los clientes junto al asunto. -->
                  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">%2$s</div>

                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
                         style="background-color:#EEF1F6;padding:24px 12px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
                               style="width:600px;max-width:100%%;background-color:#FFFFFF;
                                      border-radius:14px;overflow:hidden;
                                      font-family:Arial,Helvetica,sans-serif;">

                          %3$s

                          <tr>
                            <td style="padding:8px 32px 0 32px;">
                              <h1 style="margin:0;font-size:23px;line-height:1.3;color:%4$s;">%1$s</h1>
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:18px 32px 6px 32px;">
                              <p style="margin:0;font-size:16px;color:%5$s;">%2$s</p>
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:0 32px 26px 32px;font-size:15px;line-height:1.6;color:%5$s;">
                              %6$s
                            </td>
                          </tr>

                          %7$s

                          <tr>
                            <td style="background-color:%4$s;padding:16px 32px;">
                              <p style="margin:0;font-size:12px;color:#9AA4BF;line-height:1.6;">
                                %8$s
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(
                escapar(titulo),
                escapar(saludo),
                cabeceraHtml(marca, colorAcento),
                OSCURO,
                TEXTO,
                cuerpoHtml,
                pieHtml(marca),
                textoLegal(marca));
    }

    private static String textoLegal(MarcaCorreo marca) {
        if (marca != null && marca.textoLegal() != null && !marca.textoLegal().isBlank()) {
            return escapar(marca.textoLegal());
        }
        return "Este mensaje forma parte de los programas de formación y empleabilidad. Si no esperabas este correo, puedes ignorarlo.";
    }

    /**
     * Cabecera con el logo. Si no hay URL configurada se escribe el lema o titulo como
     * texto, para que el correo no salga sin identidad.
     */
    private static String cabeceraHtml(MarcaCorreo marca, String colorAcento) {
        String urlLogo = marca.logoUrl();
        String lemaCabecera = marca.textoCabecera() == null || marca.textoCabecera().isBlank()
                ? "Programa de Formación y Empleabilidad"
                : escapar(marca.textoCabecera());

        if (urlLogo == null || urlLogo.isBlank()) {
            return """
                    <tr>
                      <td style="padding:28px 32px 4px 32px;">
                        <p style="margin:0;font-size:15px;font-weight:bold;letter-spacing:0.5px;
                                  color:%s;text-transform:uppercase;">
                          %s
                        </p>
                      </td>
                    </tr>
                    """.formatted(colorAcento, lemaCabecera);
        }
        int ancho = marca.anchoLogoVisible();
        return """
                <tr>
                  <td align="center" style="padding:26px 32px 10px 32px;">
                    <img src="%s" alt="%s"
                         width="%d"%s
                         style="display:block;width:%dpx;max-width:80%%;height:auto;border:0;">
                  </td>
                </tr>
                """.formatted(escapar(urlLogo), lemaCabecera, ancho, atributoAlto(marca.altoLogoVisible()), ancho);
    }

    /**
     * El atributo {@code height}, solo si se conoce.
     *
     * <p>Outlook no deduce el alto del CSS: sin este atributo dibuja la imagen
     * al tamano del archivo, y como las imagenes se piden al doble de
     * resolucion, la cabecera saldria al doble de alto. Cuando no se sabe el
     * alto se omite —mejor eso que escribir uno inventado, que deformaria la
     * imagen en todos los clientes.
     */
    private static String atributoAlto(Integer alto) {
        return alto == null ? "" : "\n                         height=\"" + alto + "\"";
    }

    /**
     * Pie con el banner institucional. Lleva los logos de los aliados, de modo
     * que cuando no se muestra la imagen hay que nombrarlos en texto: son parte
     * del compromiso con las entidades que financian el programa.
     */
    private static String pieHtml(MarcaCorreo marca) {
        String urlBanner = marca.bannerUrl();
        String texto = marca.textoPie() == null || marca.textoPie().isBlank()
                ? "Programa de Formación y Empleabilidad"
                : escapar(marca.textoPie());

        if (urlBanner == null || urlBanner.isBlank()) {
            return """
                    <tr>
                      <td style="background-color:#F4F6FA;padding:20px 32px;">
                        <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:1px;
                                  color:%s;text-transform:uppercase;">
                          Una iniciativa de · Operada por · En alianza con
                        </p>
                        <p style="margin:0;font-size:13px;color:%s;line-height:1.7;">
                          %s
                        </p>
                      </td>
                    </tr>
                    """.formatted(GRIS_SUAVE, TEXTO, texto);
        }
        int ancho = marca.anchoBannerVisible();
        return """
                <tr>
                  <td style="padding:0;">
                    <img src="%s"
                         alt="%s"
                         width="%d"%s
                         style="display:block;width:100%%;max-width:%dpx;height:auto;border:0;">
                  </td>
                </tr>
                """.formatted(
                escapar(urlBanner),
                // El alt repite lo del pie: cuando el cliente bloquea la imagen
                // —que es lo que hacen por defecto— es lo unico que queda.
                texto.replace("&nbsp;", " "),
                ancho, atributoAlto(marca.altoBannerVisible()), ancho);
    }

    /** Boton con el color institucional. */
    public static String boton(String texto, String url) {
        return boton(texto, url, null);
    }

    /**
     * Boton con el color del programa.
     *
     * <p>El color se pasa aqui y no se resuelve en {@code construir} porque el
     * boton lo arma quien redacta el mensaje, antes de envolverlo: si no se le
     * dice de que color va, sale azul institucional dentro de un correo
     * personalizado, que es peor que no personalizar nada.
     */
    public static String boton(String texto, String url, String color) {
        String fondo = color == null || color.isBlank() ? AZUL : color;
        return botonConFondo(texto, url, fondo);
    }

    /** Se dibuja con una tabla porque Outlook ignora el padding de los enlaces. */
    private static String botonConFondo(String texto, String url, String fondo) {
        return """
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
                  <tr>
                    <td style="background-color:%s;border-radius:6px;">
                      <a href="%s" style="display:inline-block;padding:14px 28px;font-size:15px;
                                          font-weight:bold;color:%s;text-decoration:none;">%s</a>
                    </td>
                  </tr>
                </table>
                """.formatted(fondo, escapar(url), textoSobre(fondo), escapar(texto));
    }

    /**
     * Blanco o negro segun lo claro que sea el fondo.
     *
     * <p>El texto del boton estaba fijo en blanco. Con el azul institucional se
     * lee, pero un programa que elija un amarillo o un verde claro se queda con
     * un boton ilegible —y el boton es justo lo que hay que pulsar para entrar.
     *
     * <p>El umbral es el mismo que usa la interfaz ({@code paleta.ts}): 0,45 y
     * no 0,5, porque el ojo percibe el blanco mas luminoso.
     */
    static String textoSobre(String hexFondo) {
        if (hexFondo == null || !hexFondo.matches("^#[0-9A-Fa-f]{6}$")) {
            return "#FFFFFF";
        }
        double luminancia = 0;
        double[] pesos = {0.2126, 0.7152, 0.0722};
        for (int i = 0; i < 3; i++) {
            double canal = Integer.parseInt(hexFondo.substring(1 + i * 2, 3 + i * 2), 16) / 255.0;
            double lineal = canal <= 0.03928 ? canal / 12.92 : Math.pow((canal + 0.055) / 1.055, 2.4);
            luminancia += pesos[i] * lineal;
        }
        return luminancia > 0.45 ? "#101828" : "#FFFFFF";
    }

    /** Recuadro destacado para un dato que el destinatario debe conservar. */
    public static String recuadroDato(String etiqueta, String valor) {
        return """
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
                       style="background-color:#F6F8FB;border-left:4px solid %1$s;
                              border-radius:6px;margin:18px 0;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <p style="margin:0 0 4px 0;font-size:12px;color:%2$s;text-transform:uppercase;">%3$s</p>
                      <p style="margin:0;font-size:16px;font-weight:bold;color:%4$s;
                                word-break:break-all;">%5$s</p>
                    </td>
                  </tr>
                </table>
                """.formatted(AZUL, GRIS_SUAVE, escapar(etiqueta), OSCURO, escapar(valor));
    }

    /**
     * Escapa el texto que viene de la base de datos.
     *
     * <p>Un nombre con {@code &} o {@code <} rompe el HTML del correo, y un
     * campo manipulado podria inyectar marcado en el mensaje.
     */
    static String escapar(String valor) {
        if (valor == null) {
            return "";
        }
        return valor.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
