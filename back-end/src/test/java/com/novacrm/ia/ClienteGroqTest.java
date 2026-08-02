package com.novacrm.ia;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClienteGroqTest {

    private HttpServer servidor;
    private int llamadasTotales;

    @AfterEach
    void cerrar() {
        if (servidor != null) {
            servidor.stop(0);
        }
    }

    @Test
    void sinClaveNoDisponibleYDevuelveVacio() {
        var groq = new ClienteGroq("", "modelo", 5_000, "http://localhost:9");
        assertFalse(groq.disponible());
        assertTrue(groq.completarJson("instrucciones", "contenido").isEmpty());
    }

    @Test
    void respuestaDelServidorSeExtrae() throws Exception {
        arrancar(200, """
                {"choices":[{"message":{"content":"{\\"valor\\": \\"participantes\\"}"}}]}
                """);
        var groq = new ClienteGroq("gsk-test", "modelo", 5_000, "http://localhost:" + puerto());
        var json = groq.completarJson("instrucciones", "contenido");
        assertTrue(json.isPresent());
        assertEquals("participantes", json.get().get("valor").asText());
    }

    @Test
    void errorDelServidorNuncaLanzaYDevuelveVacio() throws Exception {
        arrancar(429, "{\"error\":{\"message\":\"rate limit\"}}", null);
        var groq = new ClienteGroq("gsk-test", "modelo", 5_000, "http://localhost:" + puerto(), 10);
        assertTrue(groq.completarJson("instrucciones", "contenido").isEmpty());
        assertEquals(2, llamadasTotales, "debe reintentar una vez el 429");
    }

    @Test
    void reintentaEl429YLaSegundaPasadaFunciona() throws Exception {
        arrancar(429, "{\"error\":{\"message\":\"rate limit\"}}",
                """
                {"choices":[{"message":{"content":"{\\"bien\\": true}"}}]}
                """);
        var groq = new ClienteGroq("gsk-test", "modelo", 5_000, "http://localhost:" + puerto(), 10);
        var json = groq.completarJson("instrucciones", "contenido");
        assertTrue(json.isPresent(), "el reintento debía devolver el JSON válido");
        assertTrue(json.get().get("bien").asBoolean());
        assertEquals(2, llamadasTotales, "debía invocarse dos veces");
    }

    @Test
    void contenidoNoJsonDevuelveVacio() throws Exception {
        arrancar(200, """
                {"choices":[{"message":{"content":"esto no es json"}}]}
                """);
        var groq = new ClienteGroq("gsk-test", "modelo", 5_000, "http://localhost:" + puerto());
        assertTrue(groq.completarJson("instrucciones", "contenido").isEmpty());
    }

    private int puerto() {
        return servidor.getAddress().getPort();
    }

    private void arrancar(int codigo, String cuerpo) throws Exception {
        arrancar(codigo, cuerpo, null);
    }

    /**
     * Sirve {@code cuerpo} con {@code codigo}; si llega un 429 y hay
     * {@code cuerpoExitoso}, la segunda llamada responde 200 con él.
     */
    private void arrancar(int codigo, String cuerpo, String cuerpoExitoso) throws Exception {
        llamadasTotales = 0;
        servidor = HttpServer.create(new InetSocketAddress(0), 0);
        servidor.createContext("/chat/completions", intercambio -> {
            llamadasTotales++;
            boolean darExito = codigo == 429 && cuerpoExitoso != null && llamadasTotales > 1;
            if (darExito) {
                byte[] exitoso = cuerpoExitoso.getBytes(StandardCharsets.UTF_8);
                intercambio.getResponseHeaders().set("Content-Type", "application/json");
                intercambio.sendResponseHeaders(200, exitoso.length);
                try (var salida = intercambio.getResponseBody()) {
                    salida.write(exitoso);
                }
                return;
            }
            byte[] bytes = cuerpo.getBytes(StandardCharsets.UTF_8);
            intercambio.getResponseHeaders().set("Content-Type", "application/json");
            intercambio.sendResponseHeaders(codigo, bytes.length);
            try (var salida = intercambio.getResponseBody()) {
                salida.write(bytes);
            }
        });
        servidor.start();
    }
}
