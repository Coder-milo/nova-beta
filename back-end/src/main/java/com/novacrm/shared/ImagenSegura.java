package com.novacrm.shared;

import com.novacrm.exception.BusinessException;

import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.io.IOException;

/**
 * Comprueba que una imagen se puede abrir sin quedarse sin memoria.
 *
 * <p>Descomprimir una imagen es la operacion en la que un archivo pequeño se
 * convierte en algo enorme: un PNG de un mega puede declarar 30000x30000 y
 * ocupar unos 3,6 GB en memoria. Quien la lee sin mirar antes sus medidas no
 * tiene forma de defenderse, porque quedarse sin memoria lanza un {@code Error}
 * y no una {@code Exception}: no lo atrapa ningun {@code catch} de los que se
 * escriben por costumbre, y se lleva por delante a toda la aplicacion.
 *
 * <p>Por eso el orden importa y vive en un solo sitio: primero se pregunta
 * cuanto va a ocupar —eso se lee de la cabecera, sin descomprimir— y despues se
 * decide si se abre.
 */
public final class ImagenSegura {

    /**
     * Cuanto puede pesar el archivo que llega. Diez megas es holgado para una
     * foto de telefono y muy por debajo de los cincuenta que admite el
     * servidor en una peticion.
     */
    public static final int MAXIMO_BYTES = 10 * 1024 * 1024;

    /** Cincuenta megapixeles: deja pasar cualquier camara de telefono actual. */
    public static final long MAXIMO_PIXELES = 50_000_000L;

    private ImagenSegura() {}

    /**
     * Falla si la imagen no se puede abrir con seguridad.
     *
     * <p>No la abre: solo mira su cabecera.
     */
    public static void comprobar(byte[] contenido) {
        if (contenido == null || contenido.length == 0) {
            throw new BusinessException("Sube una imagen válida (JPG, PNG o WebP).");
        }
        if (contenido.length > MAXIMO_BYTES) {
            throw new BusinessException(
                    "La imagen supera los " + (MAXIMO_BYTES / (1024 * 1024)) + " MB.");
        }
        try (var entrada = ImageIO.createImageInputStream(new ByteArrayInputStream(contenido))) {
            var lectores = ImageIO.getImageReaders(entrada);
            if (!lectores.hasNext()) {
                throw new BusinessException(
                        "No se reconoce el formato de la imagen. Usa JPG, PNG o WebP.");
            }
            var lector = lectores.next();
            try {
                lector.setInput(entrada);
                long pixeles = (long) lector.getWidth(0) * lector.getHeight(0);
                if (pixeles > MAXIMO_PIXELES) {
                    throw new BusinessException(
                            "La imagen tiene demasiados píxeles. Usa una foto normal de cámara o teléfono.");
                }
            } finally {
                lector.dispose();
            }
        } catch (IOException e) {
            throw new BusinessException("No se pudo leer la imagen: " + e.getMessage());
        }
    }

    /**
     * Lo mismo, para lo que ya esta guardado.
     *
     * <p>Devuelve si se puede abrir, en vez de fallar: al generar un PDF o
     * pintar una lista, una foto vieja e inmanejable no puede tumbar la
     * operacion entera. Se omite esa foto y se sigue.
     *
     * <p>Hace falta porque en el almacenamiento hay fotos anteriores a que la
     * subida comprobara nada: cuando el reescalado fallaba se guardaban los
     * bytes originales tal cual.
     */
    public static boolean sePuedeAbrir(byte[] contenido) {
        try {
            comprobar(contenido);
            return true;
        } catch (BusinessException e) {
            return false;
        }
    }
}
