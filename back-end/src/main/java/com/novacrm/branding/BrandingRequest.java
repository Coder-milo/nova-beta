package com.novacrm.branding;

/**
 * Lo que el administrador manda al guardar la identidad de un programa.
 *
 * <p>Las medidas viajan junto a cada URL porque la interfaz las lee del archivo
 * antes de subirlo: asi el servidor puede rechazar una imagen del tamano
 * equivocado sin tener que descargarla.
 *
 * <p>Todo es opcional. Un color a null significa "vuelve a la gama global", que
 * es una eleccion legitima y no un campo sin rellenar.
 */
public record BrandingRequest(
        String colorPrimario,
        String tituloHeader,
        String subtituloHeader,

        String bannerPanelUrl,
        Integer bannerPanelAncho,
        Integer bannerPanelAlto,

        String correoHeaderUrl,
        Integer correoHeaderAncho,
        Integer correoHeaderAlto,

        String correoPieUrl,
        Integer correoPieAncho,
        Integer correoPieAlto,
        String correoTextoPie) {
}
