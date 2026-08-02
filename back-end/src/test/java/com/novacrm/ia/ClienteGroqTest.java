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
        arrancar(429, "{\"error\":{\"message\":\"rate limit\"}}");
        var groq = new ClienteGroq("gsk-test", "modelo", 5_000, "http://localhost:" + puerto());
        assertTrue(groq.completarJson("instrucciones", "contenido").isEmpty());
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
        servidor = HttpServer.create(new InetSocketAddress(0), 0);
        servidor.createContext("/chat/completions", intercambio -> {
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
