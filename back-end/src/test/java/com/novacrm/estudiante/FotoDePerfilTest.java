package com.novacrm.estudiante;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Como se sirve una foto de perfil: el tipo y cuanto puede reutilizarla el
 * navegador.
 *
 * <p>La cache no es un detalle de rendimiento suelto. La lista de
 * conversaciones pinta una foto por fila; sin cache, abrir el chat con veinte
 * conversaciones son veinte peticiones a la API en cada carga, y desde que el
 * limite se cuenta por usuario esas veinte salen de su cupo. Quien mas chatea
 * seria el primero en llevarse un 429 por mirar caras.
 */
class FotoDePerfilTest {

    @Test
    void elTipoSaleDeLaExtension() {
        assertEquals(MediaType.IMAGE_PNG, FotoDePerfil.tipoPorExtension("fotos/ana.png"));
        assertEquals(MediaType.IMAGE_GIF, FotoDePerfil.tipoPorExtension("fotos/ana.gif"));
        assertEquals(MediaType.parseMediaType("image/webp"),
                FotoDePerfil.tipoPorExtension("fotos/ana.webp"));
    }

    /** Lo que sube una camara de telefono, que es de donde salen casi todas. */
    @Test
    void loDemasSeSirveComoJpeg() {
        assertEquals(MediaType.IMAGE_JPEG, FotoDePerfil.tipoPorExtension("fotos/ana.jpg"));
        assertEquals(MediaType.IMAGE_JPEG, FotoDePerfil.tipoPorExtension("fotos/sin-extension"));
        assertEquals(MediaType.IMAGE_JPEG, FotoDePerfil.tipoPorExtension(null));
    }

    @Test
    void laExtensionNoDistingueMayusculas() {
        assertEquals(MediaType.IMAGE_PNG, FotoDePerfil.tipoPorExtension("fotos/ANA.PNG"));
    }

    @Test
    void laRespuestaLlevaElTipoYLosBytes() {
        byte[] contenido = {1, 2, 3};

        var respuesta = FotoDePerfil.respuesta("fotos/ana.png", contenido);

        assertEquals(MediaType.IMAGE_PNG, respuesta.getHeaders().getContentType());
        assertArrayEquals(contenido, respuesta.getBody());
    }

    @Test
    void laRespuestaSePuedeGuardarUnaHoraYSoloEnElNavegadorDeQuienPregunta() {
        var cache = FotoDePerfil.respuesta("fotos/ana.png", new byte[]{1})
                .getHeaders().getCacheControl();

        assertNotNull(cache);
        assertTrue(cache.contains("max-age=3600"), "una hora: estas fotos casi nunca cambian");
        assertTrue(cache.contains("private"),
                "se sirve porque quien pregunta tiene derecho a verla, asi que no "
                        + "puede quedarse en una cache compartida por el camino");
    }
}
