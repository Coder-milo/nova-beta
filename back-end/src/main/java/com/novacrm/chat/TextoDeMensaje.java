package com.novacrm.chat;

import com.novacrm.exception.BusinessException;

/**
 * Lo que se acepta como texto de un mensaje del chat.
 *
 * <p>Vive aqui y no repetido en cada sitio que guarda un mensaje. El chat de
 * dos rechazaba lo que pasara de cinco mil caracteres y el de grupo no
 * comprobaba nada: se podia dejar un megabyte de texto en un grupo, que se
 * guarda una vez y despues lo descarga cada miembro cada vez que lo abre.
 *
 * <p>Es el mismo fallo que ha aparecido varias veces en este proyecto: una
 * regla escrita en un camino y no en su gemelo. Escrita una sola vez no puede
 * separarse.
 */
public final class TextoDeMensaje {

    /**
     * Cinco mil caracteres son unas dos paginas. Un chat no es el sitio para
     * mas que eso, y el limite existe sobre todo para que nadie deje algo
     * enorme que despues descarga todo el mundo.
     */
    public static final int MAXIMO = 5000;

    private TextoDeMensaje() {}

    /** El texto limpio, o un error que explica que pasa. */
    public static String validado(String contenido) {
        String texto = contenido == null ? "" : contenido.trim();
        if (texto.isBlank()) {
            throw new BusinessException("Escribe un mensaje antes de enviarlo.");
        }
        if (texto.length() > MAXIMO) {
            throw new BusinessException("El mensaje no puede superar " + MAXIMO + " caracteres.");
        }
        return texto;
    }
}
