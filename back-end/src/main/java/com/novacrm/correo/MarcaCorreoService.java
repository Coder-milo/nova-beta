package com.novacrm.correo;

import com.novacrm.branding.BrandingService;
import com.novacrm.config.MarcaCorreo;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Con qué marca sale un correo.
 *
 * <p>Manda la del programa; lo que ese programa no haya configurado se rellena
 * con la institucional. Así un programa a medio personalizar no deja al
 * estudiante con un correo desnudo, y no hace falta duplicar la configuración
 * global en cada uno.
 *
 * <p>Vive aquí y no dentro del servicio de cuentas porque la previsualización
 * del panel necesita exactamente la misma resolución: si cada uno la calculara
 * por su lado, lo que enseña la pantalla dejaría de ser lo que recibe el
 * estudiante en cuanto alguien tocara uno de los dos.
 */
@Service
public class MarcaCorreoService {

    private final BrandingService brandingService;

    @Value("${app.correo.logo-url:}")
    private String logoUrl;

    @Value("${app.correo.banner-pie-url:}")
    private String bannerPieUrl;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${app.correo.base-url-publica:http://localhost:8080}")
    private String baseUrlPublica;

    public MarcaCorreoService(BrandingService brandingService) {
        this.brandingService = brandingService;
    }

    /** @param programaId nulo devuelve la marca institucional */
    public MarcaCorreo para(UUID programaId) {
        return brandingService.paraCorreo(programaId)
                .map(b -> new MarcaCorreo(
                        urlDe(primeroNoVacio(b.getCorreoHeaderUrl(), logoUrl)),
                        b.getCorreoHeaderAncho(),
                        b.getCorreoHeaderAlto(),
                        urlDe(primeroNoVacio(b.getCorreoPieUrl(), bannerPieUrl)),
                        b.getCorreoPieAncho(),
                        b.getCorreoPieAlto(),
                        b.getCorreoTextoPie(),
                        b.getColorPrimario()))
                .orElseGet(this::global);
    }

    public MarcaCorreo global() {
        return MarcaCorreo.global(urlDe(logoUrl), urlDe(bannerPieUrl));
    }

    public String frontendUrl() {
        return frontendUrl;
    }

    private String urlDe(String url) {
        return com.novacrm.branding.ImagenBrandingService.urlDe(url, baseUrlPublica);
    }

    private static String primeroNoVacio(String preferido, String respaldo) {
        return preferido == null || preferido.isBlank() ? respaldo : preferido;
    }
}
