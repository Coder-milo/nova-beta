package com.novacrm.branding;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * La tabla guarda la clave de la imagen, no una URL con el host de quien la
 * subio.
 *
 * <p>Una URL guardada en la base de datos se queda rota cuando el despliegue
 * cambia —y en desarrollo nace apuntando a {@code localhost}, que el cliente de
 * correo del destinatario intenta abrir en <em>su propia</em> maquina. La clave
 * no lleva host; la URL publica se construye al servir, colgada de la base que
 * tenga el entorno en ese momento.
 */
class UrlLocalCorreoTest {

    @Test
    @DisplayName("una clave se sirve colgada de la base publica configurada")
    void claveSeCuelgaDeLaBasePublica() {
        assertEquals("https://api.novacrm.com/api/v1/branding/imagen/branding/logo.png",
                ImagenBrandingService.urlDe("branding/logo.png", "https://api.novacrm.com"));
    }

    @Test
    @DisplayName("una URL completa de este servidor se reduce a su clave")
    void urlDelServidorSeReduceAClave() {
        assertEquals("branding/logo.png",
                ImagenBrandingService.claveDe(
                        "http://localhost:8080/api/v1/branding/imagen/branding/logo.png"));
        assertEquals("https://api.novacrm.com/api/v1/branding/imagen/branding/logo.png",
                ImagenBrandingService.urlDe(
                        "http://localhost:8080/api/v1/branding/imagen/branding/logo.png",
                        "https://api.novacrm.com"));
    }

    @Test
    @DisplayName("una URL externa no se toca")
    void urlExternaNoSeToca() {
        String url = "https://cdn.example.com/branding.png";
        assertEquals(url, ImagenBrandingService.claveDe(url));
        assertEquals(url, ImagenBrandingService.urlDe(url, "https://api.novacrm.com"));
    }

    @Test
    @DisplayName("null o vacio pasan sin cambio")
    void nullOVacioPasan() {
        assertNull(ImagenBrandingService.claveDe(null));
        assertNull(ImagenBrandingService.urlDe(null, "https://api.novacrm.com"));
        assertNull(ImagenBrandingService.claveDe("  "));
        assertNull(ImagenBrandingService.urlDe("  ", "https://api.novacrm.com"));
    }
}