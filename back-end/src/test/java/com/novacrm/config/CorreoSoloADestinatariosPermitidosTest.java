package com.novacrm.config;

import com.novacrm.config.correo.ProveedorCorreo;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * La lista de destinatarios permitidos es lo unico que separa una prueba de
 * escribirle a una persona real, en una base de desarrollo que tiene los datos
 * de los 108 participantes.
 *
 * <p>Vivia en dos servicios y faltaba en un tercero: el correo de recuperacion
 * de contrasena salia sin pasar por ella. Ahora se aplica en EmailService, que
 * es la puerta por la que cruza todo el correo del sistema.
 */
class CorreoSoloADestinatariosPermitidosTest {

    private ProveedorCorreo proveedor;

    private EmailService servicioCon(String listaConfigurada) {
        proveedor = mock(ProveedorCorreo.class);
        when(proveedor.enviar(any(), any(), any())).thenReturn(EmailService.Resultado.ok());
        return new EmailService(proveedor, new DestinatariosPermitidos(listaConfigurada));
    }

    @Test
    void sinListaSeEnviaANadieEnParticularYPorTantoATodos() {
        var servicio = servicioCon("");

        var resultado = servicio.enviar("quien.sea@ejemplo.com", "Asunto", "<p>Hola</p>");

        assertTrue(resultado.enviado());
        verify(proveedor).enviar("quien.sea@ejemplo.com", "Asunto", "<p>Hola</p>");
    }

    @Test
    void conListaSoloSeEscribeAQuienEstaEnElla() {
        var servicio = servicioCon("pruebas@novacrm.test");

        var permitido = servicio.enviar("pruebas@novacrm.test", "Asunto", "<p>Hola</p>");

        assertTrue(permitido.enviado());
        verify(proveedor).enviar(eq("pruebas@novacrm.test"), any(), any());
    }

    /** El caso que importa: una persona real de la base de desarrollo. */
    @Test
    void conListaNoSeEscribeAQuienNoEstaEnElla() {
        var servicio = servicioCon("pruebas@novacrm.test");

        var bloqueado = servicio.enviar("estudiante.real@gmail.com", "Asunto", "<p>Hola</p>");

        assertFalse(bloqueado.enviado());
        verify(proveedor, never()).enviar(any(), any(), any());
    }

    @Test
    void laListaAdmiteVariasDireccionesYNoDistingueMayusculas() {
        var servicio = servicioCon("uno@novacrm.test, Dos@novacrm.test");

        assertTrue(servicio.enviar("uno@novacrm.test", "a", "b").enviado());
        assertTrue(servicio.enviar("DOS@novacrm.test", "a", "b").enviado());
        assertFalse(servicio.enviar("tres@novacrm.test", "a", "b").enviado());
    }

    /** Un destinatario nulo no puede colarse por el hueco de la comprobacion. */
    @Test
    void unDestinatarioNuloNoSeEnvia() {
        var servicio = servicioCon("pruebas@novacrm.test");

        assertFalse(servicio.enviar(null, "Asunto", "<p>Hola</p>").enviado());
        verify(proveedor, never()).enviar(any(), any(), any());
    }
}
