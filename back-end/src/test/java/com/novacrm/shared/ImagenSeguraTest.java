package com.novacrm.shared;

import com.novacrm.exception.BusinessException;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * La comprobacion que va antes de descomprimir una imagen.
 *
 * <p>Hay tres sitios que abren imagenes: la foto del estudiante, las del
 * branding y la que se incrusta en el PDF de la hoja de vida. Los tres leian
 * primero y preguntaban despues, que es el orden en el que un archivo de un
 * mega se convierte en 3,6 GB de memoria sin que nadie pueda impedirlo:
 * quedarse sin memoria lanza un Error y no lo atrapa ningun catch.
 */
class ImagenSeguraTest {

    private static byte[] png(int ancho, int alto) throws Exception {
        var img = new BufferedImage(ancho, alto, BufferedImage.TYPE_INT_RGB);
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(img, "png", bytes);
        return bytes.toByteArray();
    }

    @Test
    void unaFotoNormalPasa() throws Exception {
        assertDoesNotThrow(() -> ImagenSegura.comprobar(png(1200, 800)));
        assertTrue(ImagenSegura.sePuedeAbrir(png(1200, 800)));
    }

    /**
     * El caso que motiva todo: se rechaza por lo que ocupara al descomprimirse,
     * no por lo que pesa el archivo. Este PNG son unos pocos kilobytes.
     */
    @Test
    void seRechazaPorLosPixelesAunqueElArchivoSeaPequeno() throws Exception {
        byte[] pocosKilobytes = png(9000, 9000);

        assertTrue(pocosKilobytes.length < ImagenSegura.MAXIMO_BYTES,
                "el archivo pasa el limite de tamaño; lo que no pasa son sus medidas");
        var ex = assertThrows(BusinessException.class, () -> ImagenSegura.comprobar(pocosKilobytes));
        assertTrue(ex.getMessage().toLowerCase().contains("píxeles"));
    }

    @Test
    void seRechazaLoQuePesaDemasiado() {
        var ex = assertThrows(BusinessException.class,
                () -> ImagenSegura.comprobar(new byte[ImagenSegura.MAXIMO_BYTES + 1]));
        assertTrue(ex.getMessage().contains("10 MB"));
    }

    @Test
    void loQueNoEsUnaImagenSeRechaza() {
        assertThrows(BusinessException.class,
                () -> ImagenSegura.comprobar("esto no es una imagen".getBytes()));
        assertThrows(BusinessException.class, () -> ImagenSegura.comprobar(null));
        assertThrows(BusinessException.class, () -> ImagenSegura.comprobar(new byte[0]));
    }

    /**
     * La version que no falla, para lo que ya esta guardado: una foto vieja e
     * inmanejable no puede tumbar la generacion de 500 hojas de vida.
     */
    @Test
    void loGuardadoQueNoSePuedeAbrirSeOmiteEnVezDeFallar() throws Exception {
        assertFalse(ImagenSegura.sePuedeAbrir(png(9000, 9000)));
        assertFalse(ImagenSegura.sePuedeAbrir("basura".getBytes()));
        assertFalse(ImagenSegura.sePuedeAbrir(null));
    }
}
