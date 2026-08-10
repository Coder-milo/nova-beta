package com.novacrm.chat;

import com.novacrm.exception.BusinessException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Que se acepta como texto de un mensaje.
 *
 * <p>La regla estaba escrita en el chat de dos y no en el de grupo: alli se
 * podia dejar un texto de cualquier tamaño, que se guarda una vez y despues lo
 * descarga cada miembro cada vez que abre el grupo. Es el mismo fallo que ha
 * salido varias veces en este proyecto —una regla en un camino y no en su
 * gemelo—, asi que ahora esta escrita una sola vez.
 */
class TextoDeMensajeTest {

    @Test
    void unMensajeNormalPasaYSeLimpia() {
        assertEquals("hola", TextoDeMensaje.validado("  hola  "));
    }

    @Test
    void noSeEnviaLoVacio() {
        assertThrows(BusinessException.class, () -> TextoDeMensaje.validado(null));
        assertThrows(BusinessException.class, () -> TextoDeMensaje.validado(""));
        assertThrows(BusinessException.class, () -> TextoDeMensaje.validado("   \n  "));
    }

    @Test
    void justoEnElLimitePasa() {
        String alBorde = "a".repeat(TextoDeMensaje.MAXIMO);

        assertEquals(alBorde, TextoDeMensaje.validado(alBorde));
    }

    @Test
    void pasarseDelLimiteNo() {
        String unoDeMas = "a".repeat(TextoDeMensaje.MAXIMO + 1);

        var ex = assertThrows(BusinessException.class, () -> TextoDeMensaje.validado(unoDeMas));
        assertTrue(ex.getMessage().contains(String.valueOf(TextoDeMensaje.MAXIMO)),
                "el error dice cual es el limite: sin el numero, quien lo lee no "
                        + "sabe cuanto tiene que recortar");
    }

    /**
     * Se mide despues de limpiar. Un texto que solo se pasa por los espacios
     * del final si cabe, y rechazarlo seria incomprensible para quien escribe.
     */
    @Test
    void losEspaciosDelFinalNoCuentanParaElLimite() {
        String justo = "a".repeat(TextoDeMensaje.MAXIMO) + "     ";

        assertEquals(TextoDeMensaje.MAXIMO, TextoDeMensaje.validado(justo).length());
    }
}
