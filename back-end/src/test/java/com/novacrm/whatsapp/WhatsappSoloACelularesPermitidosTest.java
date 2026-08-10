package com.novacrm.whatsapp;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

/**
 * El gemelo de la lista de correos permitidos, para el otro canal.
 *
 * <p>El riesgo aqui es mayor: la base de desarrollo lleva los celulares reales
 * de los 108 participantes, el proveedor por defecto es Meta —el de verdad— y
 * una plantilla enviada ni se recoge ni se deja de pagar.
 */
class WhatsappSoloACelularesPermitidosTest {

    private static final UUID PROGRAMA = UUID.randomUUID();

    private ProveedorWhatsapp proveedor;

    private WhatsappSender senderCon(String listaConfigurada) {
        proveedor = mock(ProveedorWhatsapp.class);
        when(proveedor.enviarTexto(any(), any(), any())).thenReturn(WhatsappSender.Resultado.ok());
        when(proveedor.enviarPlantilla(any(), any(), any(), anyList(), anyList()))
                .thenReturn(WhatsappSender.Resultado.ok());
        return new WhatsappSender(proveedor, new CelularesPermitidos(listaConfigurada));
    }

    @Test
    void sinListaSeEnviaComoSiempre() {
        var sender = senderCon("");

        assertTrue(sender.enviarTexto(PROGRAMA, "+573001234567", "Hola").enviado());
        verify(proveedor).enviarTexto(eq(PROGRAMA), eq("+573001234567"), eq("Hola"));
    }

    /** El caso que importa: un celular real de la base de desarrollo. */
    @Test
    void conListaNoSeEscribeAQuienNoEstaEnElla() {
        var sender = senderCon("+573009999999");

        var resultado = sender.enviarTexto(PROGRAMA, "+573001234567", "Hola");

        assertFalse(resultado.enviado());
        verify(proveedor, never()).enviarTexto(any(), any(), any());
    }

    @Test
    void laPlantillaTambienSeFrena() {
        var sender = senderCon("+573009999999");

        var resultado = sender.enviarPlantilla(PROGRAMA, "+573001234567", "aviso_match",
                List.of("Ana"), List.of());

        assertFalse(resultado.enviado());
        verify(proveedor, never()).enviarPlantilla(any(), any(), any(), anyList(), anyList());
    }

    /**
     * Quien configura la lista la escribe a mano: un espacio de mas, o escribir
     * el numero sin indicativo, no puede ser la diferencia entre frenar un
     * envio y no frenarlo.
     */
    @Test
    void laListaSeComparaNormalizada() {
        var sender = senderCon("300 123 4567");

        assertTrue(sender.enviarTexto(PROGRAMA, "+573001234567", "Hola").enviado());
        assertTrue(sender.enviarTexto(PROGRAMA, "3001234567", "Hola").enviado());
        assertTrue(sender.enviarTexto(PROGRAMA, "57 300 123 45 67", "Hola").enviado());
    }

    @Test
    void unNumeroNuloNoSeEnvia() {
        var sender = senderCon("+573009999999");

        assertFalse(sender.enviarTexto(PROGRAMA, null, "Hola").enviado());
        verify(proveedor, never()).enviarTexto(any(), any(), any());
    }

    @Test
    void variosNumerosEnLaLista() {
        var sender = senderCon("3001111111, 3002222222");

        assertTrue(sender.enviarTexto(PROGRAMA, "+573001111111", "Hola").enviado());
        assertTrue(sender.enviarTexto(PROGRAMA, "+573002222222", "Hola").enviado());
        assertFalse(sender.enviarTexto(PROGRAMA, "+573003333333", "Hola").enviado());
    }
}
