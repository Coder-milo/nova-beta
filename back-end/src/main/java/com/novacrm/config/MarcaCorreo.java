package com.novacrm.config;

/**
 * La marca con la que sale un correo: que imagenes lleva, a que tamano y con
 * que color se pinta el boton.
 *
 * <p>Existe para que la plantilla no tenga que saber de programas ni de base de
 * datos. Quien la construye decide si viene del branding de un programa o de la
 * configuracion global; la plantilla solo recibe valores ya resueltos.
 *
 * <p>Las medidas importan de verdad: Outlook no calcula el tamano de una imagen
 * a partir del CSS, usa los atributos {@code width} y {@code height} del HTML, y
 * si faltan la dibuja al tamano del archivo. Con imagenes pedidas al doble de
 * resolucion —para que no se vean borrosas en pantallas retina— eso significa un
 * correo con la cabecera al doble de ancho, descuadrado.
 *
 * @param logoUrl       imagen de la cabecera; null = se escribe el lema en texto
 * @param logoAncho     ancho del archivo en px; null = se usa el ancho por defecto
 * @param logoAlto      alto del archivo en px
 * @param bannerUrl     imagen del pie; null = se nombran los aliados en texto
 * @param bannerAncho   ancho del archivo en px
 * @param bannerAlto    alto del archivo en px
 * @param textoPie      linea del pie; null = la de los aliados del programa marco
 * @param colorPrimario color del boton; null = el azul institucional
 * @param textoCabecera lema o titulo de cabecera; null = valor por defecto
 * @param textoLegal    aviso legal o pie de pagina; null = valor por defecto
 */
public record MarcaCorreo(
        String logoUrl,
        Integer logoAncho,
        Integer logoAlto,
        String bannerUrl,
        Integer bannerAncho,
        Integer bannerAlto,
        String textoPie,
        String colorPrimario,
        String textoCabecera,
        String textoLegal) {

    public MarcaCorreo(String logoUrl, Integer logoAncho, Integer logoAlto,
                       String bannerUrl, Integer bannerAncho, Integer bannerAlto,
                       String textoPie, String colorPrimario) {
        this(logoUrl, logoAncho, logoAlto, bannerUrl, bannerAncho, bannerAlto, textoPie, colorPrimario, null, null);
    }

    /** Ancho maximo del cuerpo del correo. Es el limite que respeta Outlook. */
    public static final int ANCHO_CORREO = 600;

    /** Ancho al que se muestra el logo de cabecera cuando no se sabe el suyo. */
    private static final int ANCHO_LOGO_POR_DEFECTO = 260;

    /** La marca global, la que se usa cuando el programa no tiene la suya. */
    public static MarcaCorreo global(String logoUrl, String bannerUrl) {
        return new MarcaCorreo(logoUrl, null, null, bannerUrl, null, null, null, null);
    }

    /**
     * A que ancho se muestra el logo.
     *
     * <p>Las imagenes se piden al doble de resolucion, asi que se muestran a la
     * mitad; sin pasar de lo que cabe en el correo.
     */
    public int anchoLogoVisible() {
        if (logoAncho == null || logoAncho <= 0) {
            return ANCHO_LOGO_POR_DEFECTO;
        }
        return Math.min(logoAncho / 2, ANCHO_CORREO);
    }

    /** El alto que corresponde a {@link #anchoLogoVisible()}, o null si no se sabe. */
    public Integer altoLogoVisible() {
        return escalar(logoAncho, logoAlto, anchoLogoVisible());
    }

    public int anchoBannerVisible() {
        if (bannerAncho == null || bannerAncho <= 0) {
            return ANCHO_CORREO;
        }
        return Math.min(bannerAncho / 2, ANCHO_CORREO);
    }

    public Integer altoBannerVisible() {
        return escalar(bannerAncho, bannerAlto, anchoBannerVisible());
    }

    /**
     * Mantiene la proporcion. Se redondea al entero mas cercano y no hacia
     * abajo: un pixel de menos en cada correo se nota como una franja.
     */
    private static Integer escalar(Integer anchoOriginal, Integer altoOriginal, int anchoDestino) {
        if (anchoOriginal == null || altoOriginal == null
                || anchoOriginal <= 0 || altoOriginal <= 0) {
            return null;
        }
        return Math.round((float) altoOriginal * anchoDestino / anchoOriginal);
    }
}
