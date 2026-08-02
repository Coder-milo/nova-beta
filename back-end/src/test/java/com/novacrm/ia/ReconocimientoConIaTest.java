package com.novacrm.ia;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.excel.libro.DestinoDeHoja;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReconocimientoConIaTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void destinoValidoSeAcepta() {
        var ia = new ReconocimientoConIa(new GroqQueResponde("{\"valor\": \"participantes\"}"));
        var destino = ia.sugerirDestino("Inscritos 2025", List.of("Nombres", "Correo"));
        assertEquals(Optional.of(DestinoDeHoja.PARTICIPANTES), destino);
    }

    @Test
    void destinoInexistenteSeDescarta() {
        var ia = new ReconocimientoConIa(new GroqQueResponde("{\"valor\": \"sillas_voladoras\"}"));
        assertTrue(ia.sugerirDestino("Misterio", List.of("a")).isEmpty());
    }

    @Test
    void destinoNuloSeDescarta() {
        var ia = new ReconocimientoConIa(new GroqQueResponde("{\"valor\": null}"));
        assertTrue(ia.sugerirDestino("Misterio", List.of("a")).isEmpty());
    }

    @Test
    void sinServicioDevuelveVacio() {
        var ia = new ReconocimientoConIa(new ClienteGroq("", "modelo", 5_000));
        assertTrue(ia.sugerirDestino("Misterio", List.of("a")).isEmpty());
        assertTrue(ia.sugerirCampo("raro", Set.of("nombre")).isEmpty());
    }

    @Test
    void campoValidoSeAceptaYNormaliza() {
        var ia = new ReconocimientoConIa(new GroqQueResponde("{\"valor\": \"NOMBRE\"}"));
        assertEquals(Optional.of("nombre"), ia.sugerirCampo("Nombre completo", Set.of("nombre", "correo")));
    }

    @Test
    void campoFueraDelVocabularioSeDescarta() {
        var ia = new ReconocimientoConIa(new GroqQueResponde("{\"valor\": \"piso_favorito\"}"));
        assertTrue(ia.sugerirCampo("Piso favorito", Set.of("nombre", "correo")).isEmpty());
    }

    /** Stub que evita la red: responde con el JSON que se le dé. */
    private static final class GroqQueResponde extends ClienteGroq {
        private final String respuesta;

        GroqQueResponde(String respuesta) {
            super("gsk-test", "modelo", 5_000);
            this.respuesta = respuesta;
        }

        @Override
        public Optional<com.fasterxml.jackson.databind.JsonNode> completarJson(String instrucciones, String contenido) {
            try {
                return Optional.of(MAPPER.readTree(respuesta));
            } catch (Exception e) {
                return Optional.empty();
            }
        }
    }
}
