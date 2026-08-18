package com.novacrm.chat;

import com.novacrm.exception.BusinessException;
import org.springframework.web.multipart.MultipartFile;

import java.util.Locale;
import java.util.Set;

/**
 * Que se puede mandar por el chat entre estudiantes, y con que limites.
 *
 * <p>Solo imagen y audio, y no cualquier archivo como en la bandeja del equipo.
 * Ahi tiene sentido mandar una hoja de vida en PDF a la coordinadora; aqui sube
 * un participante y descarga otro, sin nadie en medio, asi que cuanto mas
 * estrecho sea lo que cabe, menos hay que confiar en el navegador de quien lo
 * abre. Un ejecutable o un documento con macros no tienen nada que hacer en una
 * conversacion entre companeros.
 *
 * <p>La lista es blanca a proposito: lo que no este escrito aqui no entra. Una
 * lista negra deja pasar todo lo que a nadie se le ocurrio apuntar.
 */
public final class AdjuntoDeChat {

    /** Cuantos archivos caben en un mensaje. */
    public static final int MAXIMO_POR_MENSAJE = 5;

    /** Lo que puede pesar cada uno. Una foto de movil cabe de sobra. */
    public static final long MAXIMO_BYTES = 10L * 1024L * 1024L;

    /** Cuanto puede durar una nota de voz. */
    public static final int MAXIMO_SEGUNDOS_AUDIO = 5 * 60;

    private static final Set<String> TIPOS_ADMITIDOS = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/aac", "audio/wav");

    private AdjuntoDeChat() {
    }

    /**
     * Comprueba un archivo y devuelve su tipo ya normalizado.
     *
     * @throws BusinessException con un motivo que se le puede ensenar a quien lo mando
     */
    public static String tipoValidado(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new BusinessException("El archivo esta vacio.");
        }
        if (archivo.getSize() > MAXIMO_BYTES) {
            throw new BusinessException("Cada archivo puede pesar hasta 10 MB.");
        }
        String tipo = archivo.getContentType() == null
                ? "" : archivo.getContentType().toLowerCase(Locale.ROOT).trim();
        // El navegador manda a veces el tipo con parametros: "audio/webm;codecs=opus".
        int puntoYComa = tipo.indexOf(';');
        if (puntoYComa > 0) {
            tipo = tipo.substring(0, puntoYComa).trim();
        }
        if (!TIPOS_ADMITIDOS.contains(tipo)) {
            throw new BusinessException(
                    "En el chat solo se pueden enviar imagenes y notas de voz.");
        }
        return tipo;
    }

    /**
     * El nombre con el que se guarda.
     *
     * <p>Sin barras ni saltos de linea: lo primero porque el nombre acaba en una
     * clave de almacenamiento, y lo segundo porque acaba en una cabecera HTTP.
     * Se recorta al tope de la columna en vez de rechazarlo, que perder el
     * mensaje por un nombre largo no ayuda a nadie.
     */
    public static String nombreSeguro(String nombreOriginal) {
        String nombre = nombreOriginal == null ? "" : nombreOriginal
                .replace('\\', '_').replace('/', '_')
                .replaceAll("[\\r\\n]", "")
                .trim();
        if (nombre.isBlank()) {
            nombre = "archivo";
        }
        return nombre.length() > 255 ? nombre.substring(0, 255) : nombre;
    }

    /**
     * La duracion declarada de una nota de voz, si es creible.
     *
     * <p>La manda el navegador, asi que no es un dato de fiar: se acota y lo que
     * no encaje se guarda como desconocido en vez de rechazar el audio. Es un
     * adorno de la pantalla, no una regla.
     */
    public static Integer duracionValidada(Integer segundos, String tipo) {
        if (segundos == null || tipo == null || !tipo.startsWith("audio/")) {
            return null;
        }
        if (segundos <= 0 || segundos > MAXIMO_SEGUNDOS_AUDIO) {
            return null;
        }
        return segundos;
    }
}
