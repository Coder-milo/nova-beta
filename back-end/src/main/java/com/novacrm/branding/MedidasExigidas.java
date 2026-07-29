package com.novacrm.branding;

import java.util.List;

/**
 * Las medidas que se le piden al administrador para cada imagen.
 *
 * <p>No son una preferencia estetica. Un correo se ve en Outlook, en Gmail y en
 * un movil, y ninguno de los tres se comporta igual:
 *
 * <ul>
 *   <li><strong>600 px de ancho</strong> es el limite historico de Outlook.
 *       Mas ancho y recorta el mensaje.
 *   <li><strong>El doble de resolucion</strong> (1200 px de archivo para 600 de
 *       visualizacion) porque en pantallas retina una imagen a tamano exacto se
 *       ve borrosa.
 *   <li>El HTML lleva {@code width} y {@code height} escritos: sin ellos
 *       Outlook usa el tamano del archivo y descuadra la maqueta.
 * </ul>
 *
 * <p>Se exigen exactas y no "maximas" porque una imagen de otra proporcion se
 * deforma o deja franjas, y eso no se descubre hasta que el correo ya salio a
 * los 108 estudiantes.
 *
 * <p>Clase de datos pura, sin Spring: se puede probar sin levantar nada.
 */
public final class MedidasExigidas {

    private MedidasExigidas() {}

    /**
     * @param clave      identificador de la imagen
     * @param etiqueta   como se le llama en la interfaz
     * @param ancho      ancho exacto del archivo, en px
     * @param alto       alto exacto del archivo, en px
     * @param anchoVista a que ancho se muestra (la mitad, por las pantallas retina)
     * @param porque     que pasa si no se respeta
     */
    public record Medida(
            String clave,
            String etiqueta,
            int ancho,
            int alto,
            int anchoVista,
            String porque) {

        public String comoTexto() {
            return ancho + " x " + alto + " px";
        }
    }

    /**
     * Fondo de la tarjeta de bienvenida del portal estudiantil. El archivo se
     * conserva ancho para que cubra el bloque de bienvenida sin deformarse; la
     * interfaz pone una capa de contraste encima del lado donde va el saludo.
     */
    public static final Medida BANNER_PANEL = new Medida(
            "bannerPanel", "Banner de bienvenida", 2400, 300, 1200,
            "Se muestra solo detrás del saludo de bienvenida en el portal de los estudiantes "
                    + "del proyecto. No aparece en el panel administrador, la barra superior ni el menú lateral. "
                    + "Mantén los elementos importantes hacia el centro y deja margen a los lados.");

    public static final Medida CORREO_HEADER = new Medida(
            "correoHeader", "Cabecera del correo", 1200, 400, 600,
            "600 px es el ancho maximo que respeta Outlook; se pide al doble para que no se "
                    + "vea borrosa en pantallas retina.");

    public static final Medida CORREO_PIE = new Medida(
            "correoPie", "Pie del correo", 1200, 300, 600,
            "Va al final del mensaje. Mas alto de 300 px y en el movil tapa la firma.");

    public static final List<Medida> TODAS = List.of(BANNER_PANEL, CORREO_HEADER, CORREO_PIE);

    /**
     * Comprueba unas medidas contra las exigidas.
     *
     * @return el motivo del rechazo, o null si estan bien
     */
    public static String validar(Medida exigida, Integer ancho, Integer alto) {
        if (ancho == null && alto == null) {
            // Sin medidas declaradas no hay nada que validar; es el caso de
            // quien guarda solo el color y no toca las imagenes.
            return null;
        }
        if (ancho == null || alto == null) {
            return exigida.etiqueta() + ": faltan las medidas. Se exige "
                    + exigida.comoTexto() + ".";
        }
        if (ancho != exigida.ancho() || alto != exigida.alto()) {
            return exigida.etiqueta() + ": la imagen mide " + ancho + " x " + alto
                    + " px y se exige " + exigida.comoTexto() + ". " + exigida.porque();
        }
        return null;
    }
}
