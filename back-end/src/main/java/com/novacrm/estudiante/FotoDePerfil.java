package com.novacrm.estudiante;

import org.springframework.http.MediaType;

import java.util.Locale;

/**
 * Cómo se sirve la foto de perfil que hay guardada en el almacenamiento.
 *
 * <p>Vive aquí y no repetida en cada controlador que la devuelve. Son dos —el
 * de la ficha y el del chat— y la regla es la misma; dos copias de lo mismo es
 * la forma en que en este proyecto se han separado ya varias veces.
 */
public final class FotoDePerfil {

    /**
     * Cuanto puede reutilizar el navegador una foto sin volver a pedirla.
     *
     * <p>Una hora. Estas fotos casi nunca cambian y la lista de conversaciones
     * pinta una por fila: sin esto, abrir el chat con veinte conversaciones son
     * veinte peticiones a la API en cada carga, y desde que el limite se cuenta
     * por usuario esas veinte salen de su cupo. Quien mas chatea seria el
     * primero en llevarse un 429 por mirar caras.
     *
     * <p>{@code private} y no {@code public}: la foto se sirve porque quien
     * pregunta tiene derecho a verla, asi que puede quedarse en su navegador
     * pero no en una cache compartida por el camino.
     */
    private static final java.time.Duration CACHE = java.time.Duration.ofHours(1);

    /** Lado de la foto que se guarda. Es un avatar, no una fotografia. */
    private static final int LADO = 250;

    private FotoDePerfil() {}

    /**
     * Deja la foto lista para guardar: cuadrada, pequeña y en JPEG.
     *
     * <p>Falla en voz alta si no puede. Antes devolvia los bytes originales
     * cuando el reescalado no salia, y quien llama los guarda como
     * {@code image/jpeg} con la clave terminada en {@code .jpg}: se servia un
     * PNG diciendo que era JPEG y, con {@code nosniff} puesto, el navegador no
     * lo corrige y la foto no se ve. Preferible no aceptar la foto que aceptar
     * una que no se va a ver.
     */
    public static byte[] prepararCuadrada(byte[] originales) {
        com.novacrm.shared.ImagenSegura.comprobar(originales);

        try (var entrada = new java.io.ByteArrayInputStream(originales)) {
            java.awt.image.BufferedImage img = javax.imageio.ImageIO.read(entrada);
            if (img == null) {
                throw new com.novacrm.exception.BusinessException(
                        "No se reconoce el formato de la imagen. Usa JPG, PNG o WebP.");
            }
            int lado = Math.min(img.getWidth(), img.getHeight());
            var recorte = img.getSubimage((img.getWidth() - lado) / 2, (img.getHeight() - lado) / 2, lado, lado);

            int destino = Math.min(lado, LADO);
            var salida = new java.awt.image.BufferedImage(destino, destino,
                    java.awt.image.BufferedImage.TYPE_INT_RGB);
            var g = salida.createGraphics();
            g.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION,
                    java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(recorte, 0, 0, destino, destino, null);
            g.dispose();

            var bytes = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(salida, "jpg", bytes);
            return bytes.toByteArray();
        } catch (java.io.IOException e) {
            throw new com.novacrm.exception.BusinessException("No se pudo leer la imagen: " + e.getMessage());
        }
    }


    /** La respuesta completa: tipo, cache y bytes. */
    public static org.springframework.http.ResponseEntity<byte[]> respuesta(String clave, byte[] contenido) {
        return org.springframework.http.ResponseEntity.ok()
                .contentType(tipoPorExtension(clave))
                .cacheControl(org.springframework.http.CacheControl.maxAge(CACHE).cachePrivate())
                .body(contenido);
    }

    /**
     * El tipo de imagen segun la extension de la clave guardada.
     *
     * <p>Por la extension y no por lo que declaro quien subio: lo que se guarda
     * es una clave que compone el servidor, mientras que el tipo declarado
     * viene del cliente. JPEG por defecto porque es lo que sube una camara de
     * telefono, que es de donde salen casi todas estas fotos.
     */
    public static MediaType tipoPorExtension(String clave) {
        if (clave == null) {
            return MediaType.IMAGE_JPEG;
        }
        String minuscula = clave.toLowerCase(Locale.ROOT);
        if (minuscula.endsWith(".png")) {
            return MediaType.IMAGE_PNG;
        }
        if (minuscula.endsWith(".webp")) {
            return MediaType.parseMediaType("image/webp");
        }
        if (minuscula.endsWith(".gif")) {
            return MediaType.IMAGE_GIF;
        }
        return MediaType.IMAGE_JPEG;
    }
}
