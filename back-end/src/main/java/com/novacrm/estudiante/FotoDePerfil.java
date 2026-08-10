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

    private FotoDePerfil() {}

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
