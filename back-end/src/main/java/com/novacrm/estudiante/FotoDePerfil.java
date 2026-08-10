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

    private FotoDePerfil() {}

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
