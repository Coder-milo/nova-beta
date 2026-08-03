package com.novacrm.branding;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Las medidas que se exigen al subir una imagen.
 *
 * <p>El fallo que esto evita no se ve hasta que el correo ya salio: una imagen
 * de otra proporcion se deforma o deja franjas en Outlook, y para entonces ya
 * la recibieron los 108 estudiantes.
 */
class MedidasExigidasTest {

    @Test
    void lasMedidasExactasPasan() {
        assertNull(MedidasExigidas.validar(MedidasExigidas.CORREO_HEADER, 1200, 400));
    }

    @Test
    void unaImagenDeOtroTamanoSeRechazaDiciendoCualEsElBueno() {
        String fallo = MedidasExigidas.validar(MedidasExigidas.CORREO_HEADER, 800, 300);

        assertNotNull(fallo);
        assertTrue(fallo.contains("800 x 300"), "debe decir que subio: " + fallo);
        assertTrue(fallo.contains("1200 x 400"), "y que se esperaba: " + fallo);
    }

    @Test
    void noBastaConAcertarElAncho() {
        assertNotNull(MedidasExigidas.validar(MedidasExigidas.CORREO_PIE, 1200, 900),
                "una imagen mas alta deforma la maqueta aunque el ancho cuadre");
    }

    @Test
    void declararSoloUnaDeLasDosMedidasEsUnError() {
        assertNotNull(MedidasExigidas.validar(MedidasExigidas.BANNER_PANEL, 1600, null));
        assertNotNull(MedidasExigidas.validar(MedidasExigidas.BANNER_PANEL, null, 400));
    }

    @Test
    void sinMedidasNoHayNadaQueValidar() {
        // Es el caso de quien solo cambia el color y no toca las imagenes.
        assertNull(MedidasExigidas.validar(MedidasExigidas.BANNER_PANEL, null, null));
    }

    @Test
    void cadaMedidaExplicaPorQueEsEsaYNoOtra() {
        for (var medida : MedidasExigidas.TODAS) {
            assertFalse(medida.porque().isBlank(),
                    medida.etiqueta() + " no explica por que se exige ese tamano");
            assertEquals(medida.ancho() / 2, medida.anchoVista(),
                    medida.etiqueta() + ": se pide al doble para las pantallas retina");
        }
    }
}
