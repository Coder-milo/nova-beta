package com.novacrm.shared;

import org.springframework.http.ContentDisposition;

import java.nio.charset.StandardCharsets;

/**
 * La cabecera {@code Content-Disposition} de un archivo que se descarga.
 *
 * <p>Existe porque habia cuatro respuestas distintas a la misma pregunta y solo
 * una era correcta. Las descargas de documentos ya usaban
 * {@link ContentDisposition}, con el motivo escrito: pegando el nombre entre
 * comillas a mano, uno que ya lleve comillas cierra el parametro antes de
 * tiempo y el resto de la cabecera se lee como mas parametros.
 *
 * <p>Las tres descargas de hoja de vida hacian otra cosa: reemplazar por «_»
 * todo lo que no fuera {@code [a-zA-Z0-9.-]}. Eso es seguro, pero se lleva por
 * delante las tildes y las eñes, y en esta cohorte 48 de 108 nombres llevan
 * tilde. Es decir, casi la mitad de los participantes descargaba su hoja de
 * vida llamada «HV-CAC-Jos_-N__ez.pdf» y con ese nombre la mandaba a las
 * empresas.
 *
 * <p>{@code ContentDisposition} lo resuelve entero: codifica segun RFC 5987
 * —{@code filename*=UTF-8''...}— asi que el nombre llega con sus tildes, y
 * escapa lo que haga falta sin borrar nada.
 */
public final class NombreDeDescarga {

    private NombreDeDescarga() {
    }

    /** Para abrir en el navegador. */
    public static String enLinea(String nombre) {
        return cabecera("inline", nombre);
    }

    /** Para guardar en disco. */
    public static String adjunto(String nombre) {
        return cabecera("attachment", nombre);
    }

    private static String cabecera(String tipo, String nombre) {
        String limpio = nombre == null || nombre.isBlank() ? "archivo" : nombre.trim();
        return ContentDisposition.builder(tipo)
                .filename(limpio, StandardCharsets.UTF_8)
                .build()
                .toString();
    }
}
