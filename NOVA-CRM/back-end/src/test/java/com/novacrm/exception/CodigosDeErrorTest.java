package com.novacrm.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.http.HttpMethod;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Que cada fallo salga con su codigo.
 *
 * <p>Los tres casos de aqui caian en el manejador generico y salian como 500.
 * Eso tiene dos costes: el cliente no puede distinguir "me equivoque yo" de
 * "se rompio el servidor" —y por tanto no sabe si reintentar—, y cada URL mal
 * escrita quedaba registrada como "Unhandled exception" con su traza,
 * enterrando los errores de verdad.
 */
class CodigosDeErrorTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void unaRutaQueNoExisteEs404() {
        var respuesta = handler.handleRutaInexistente(
                new NoResourceFoundException(HttpMethod.GET, "/api/v1/dashboard/resumen"));

        assertEquals(HttpStatus.NOT_FOUND, respuesta.getStatusCode());
        assertEquals("NOT_FOUND", respuesta.getBody().code());
    }

    @Test
    void unJsonMalFormadoEs400() {
        var respuesta = handler.handleCuerpoIlegible(
                new HttpMessageNotReadableException("Invalid UTF-8 start byte 0xb7", (org.springframework.http.HttpInputMessage) null));

        assertEquals(HttpStatus.BAD_REQUEST, respuesta.getStatusCode());
    }

    @Test
    void elMensajeDeErrorNoFiltraDetallesInternos() {
        var respuesta = handler.handleCuerpoIlegible(
                new HttpMessageNotReadableException(
                        "Cannot deserialize com.novacrm.branding.BrandingRequest from token",
                        (org.springframework.http.HttpInputMessage) null));

        String mensaje = respuesta.getBody().message();
        assertFalse(mensaje.contains("com.novacrm"),
                "no se devuelven nombres de clases al cliente: " + mensaje);
    }

    @Test
    void unParametroObligatorioQueFaltaEs400YDiceCual() {
        var respuesta = handler.handleParametroFaltante(
                new org.springframework.web.bind.MissingServletRequestParameterException(
                        "programaId", "UUID"));

        assertEquals(HttpStatus.BAD_REQUEST, respuesta.getStatusCode());
        assertTrue(respuesta.getBody().message().contains("programaId"),
                "sin el nombre hay que ir a leer el controlador");
    }

    @Test
    void unIdConFormatoInvalidoEs400YNoRepiteElValor() {
        var respuesta = handler.handleTipoIncorrecto(
                new org.springframework.web.method.annotation.MethodArgumentTypeMismatchException(
                        "<script>alert(1)</script>", java.util.UUID.class, "programaId", null, null));

        assertEquals(HttpStatus.BAD_REQUEST, respuesta.getStatusCode());
        assertTrue(respuesta.getBody().message().contains("programaId"));
        assertFalse(respuesta.getBody().message().contains("script"),
                "el valor viene de la URL; no se devuelve tal cual");
    }

    @Test
    void unMetodoNoPermitidoEs405() {
        var respuesta = handler.handleMetodoNoSoportado(
                new HttpRequestMethodNotSupportedException("DELETE"));

        assertEquals(HttpStatus.METHOD_NOT_ALLOWED, respuesta.getStatusCode());
        assertTrue(respuesta.getBody().message().contains("DELETE"),
                "decir que metodo se rechazo ahorra el viaje de averiguarlo");
    }
}
