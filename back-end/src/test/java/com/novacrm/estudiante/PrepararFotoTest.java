package com.novacrm.estudiante;

import com.novacrm.exception.BusinessException;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Que se acepta como foto de perfil y que no.
 *
 * <p>La foto la sube el estudiante, asi que esto es una puerta abierta a los
 * 108. Lo que se comprueba aqui es el orden: mirar cuanto va a ocupar la
 * imagen antes de abrirla, y no despues.
 */
class PrepararFotoTest {

    private static byte[] imagenPng(int ancho, int alto) throws Exception {
        var img = new BufferedImage(ancho, alto, BufferedImage.TYPE_INT_RGB);
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(img, "png", bytes);
        return bytes.toByteArray();
    }

    @Test
    void unaFotoNormalSeDejaCuadradaYPequena() throws Exception {
        byte[] preparada = FotoDePerfil.prepararCuadrada(imagenPng(1200, 800));

        var leida = ImageIO.read(new java.io.ByteArrayInputStream(preparada));
        assertEquals(250, leida.getWidth());
        assertEquals(250, leida.getHeight(), "cuadrada, recortada por el centro");
    }

    /** Una foto pequena no se agranda: quedaria peor de lo que llego. */
    @Test
    void unaFotoMasPequenaQueElDestinoNoSeEstira() throws Exception {
        byte[] preparada = FotoDePerfil.prepararCuadrada(imagenPng(120, 90));

        var leida = ImageIO.read(new java.io.ByteArrayInputStream(preparada));
        assertEquals(90, leida.getWidth());
    }

    /**
     * Lo que de verdad importa: siempre sale JPEG. Antes, si el reescalado
     * fallaba, se devolvian los bytes originales y quien llama los guardaba
     * como image/jpeg con la clave .jpg. Se servia un PNG diciendo que era
     * JPEG y, con nosniff, el navegador no lo corrige: la foto no se ve.
     */
    @Test
    void siempreSaleJpeg() throws Exception {
        byte[] preparada = FotoDePerfil.prepararCuadrada(imagenPng(400, 400));

        // Cabecera JPEG: FF D8 FF.
        assertEquals((byte) 0xFF, preparada[0]);
        assertEquals((byte) 0xD8, preparada[1]);
        assertEquals((byte) 0xFF, preparada[2]);
    }

    @Test
    void loQueNoEsUnaImagenSeRechaza() {
        var ex = assertThrows(BusinessException.class,
                () -> FotoDePerfil.prepararCuadrada("esto no es una imagen".getBytes()));
        assertTrue(ex.getMessage().toLowerCase().contains("formato"));
    }

    @Test
    void nadaVacioPasa() {
        assertThrows(BusinessException.class, () -> FotoDePerfil.prepararCuadrada(null));
        assertThrows(BusinessException.class, () -> FotoDePerfil.prepararCuadrada(new byte[0]));
    }

    @Test
    void loQuePesaDemasiadoSeRechazaAntesDeAbrirlo() {
        var enorme = new byte[11 * 1024 * 1024];

        var ex = assertThrows(BusinessException.class, () -> FotoDePerfil.prepararCuadrada(enorme));
        assertTrue(ex.getMessage().contains("10 MB"));
    }

    /**
     * El caso que motiva todo esto. Un PNG de pocos kilobytes que declara
     * 30000x30000 ocupa unos 3,6 GB al descomprimirse. Se leia entero antes de
     * mirar sus medidas, asi que cualquier estudiante podia tumbar la API
     * subiendo su foto de perfil — y el catch no salvaba nada, porque quedarse
     * sin memoria lanza un Error y no una Exception.
     *
     * <p>La prueba no construye esa imagen: la construccion misma ocuparia esos
     * 3,6 GB. Comprueba el limite con una que declara mas pixeles de los
     * admitidos sin llegar a ser inmanejable.
     */
    @Test
    void unaImagenConDemasiadosPixelesSeRechazaSinDescomprimirla() throws Exception {
        // 9000 x 9000 = 81 megapixeles, por encima de los 50 admitidos.
        byte[] declaraDemasiado = imagenPng(9000, 9000);

        var ex = assertThrows(BusinessException.class,
                () -> FotoDePerfil.prepararCuadrada(declaraDemasiado));
        assertTrue(ex.getMessage().toLowerCase().contains("píxeles"));
    }
}
