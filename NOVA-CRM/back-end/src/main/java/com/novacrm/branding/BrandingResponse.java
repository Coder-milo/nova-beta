package com.novacrm.branding;

import java.util.List;
import java.util.UUID;

/**
 * La identidad de un programa tal y como la consume la interfaz.
 *
 * <p>Lleva {@code personalizado} explicito para que el frontend no tenga que
 * deducir de un color a null si debe aplicar una paleta propia o la global: una
 * ausencia se interpreta mal con demasiada facilidad.
 *
 * <p>Lleva tambien las medidas exigidas para que la pantalla de edicion las
 * muestre y las valide sin llevarlas escritas a mano en dos sitios, que es como
 * acaban discrepando.
 */
public record BrandingResponse(
        UUID programaId,
        String programaNombre,
        boolean personalizado,

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
        String correoTextoPie,

        List<MedidasExigidas.Medida> medidasExigidas) {

    public static BrandingResponse de(String programaNombre, ProgramaBranding b) {
        return new BrandingResponse(
                b.getProgramaId(),
                programaNombre,
                true,
                b.getColorPrimario(),
                b.getTituloHeader(),
                b.getSubtituloHeader(),
                b.getBannerPanelUrl(),
                b.getBannerPanelAncho(),
                b.getBannerPanelAlto(),
                b.getCorreoHeaderUrl(),
                b.getCorreoHeaderAncho(),
                b.getCorreoHeaderAlto(),
                b.getCorreoPieUrl(),
                b.getCorreoPieAncho(),
                b.getCorreoPieAlto(),
                b.getCorreoTextoPie(),
                MedidasExigidas.TODAS);
    }

    /** Sin fila en la tabla: el programa usa la gama global del panel. */
    public static BrandingResponse sinPersonalizar(UUID programaId, String programaNombre) {
        return new BrandingResponse(
                programaId, programaNombre, false,
                null, null, null,
                null, null, null,
                null, null, null,
                null, null, null, null,
                MedidasExigidas.TODAS);
    }
}
