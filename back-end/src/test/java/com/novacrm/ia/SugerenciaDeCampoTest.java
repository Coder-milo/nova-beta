package com.novacrm.ia;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.excel.libro.DestinoDeHoja;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Validacion de lo que sugiere la IA contra el vocabulario real.
 *
 * <p>El vocabulario del sistema es camelCase. La version anterior pasaba la
 * respuesta de la IA a minusculas y la buscaba tal cual en el conjunto de
 * campos, asi que <strong>42 de los 63 campos eran inalcanzables</strong>: la
 * IA acertaba y la sugerencia se descartaba en silencio. Solo funcionaban los
 * campos que ya eran minuscula —{@code celular}, {@code edad}, {@code email}—,
 * que es justo por lo que la prueba en vivo parecia correcta.
 */
class SugerenciaDeCampoTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** Proveedor de mentira que responde siempre lo mismo y cuenta llamadas. */
    private static final class ProveedorFijo implements ProveedorIa {
        private final String respuesta;
        final AtomicInteger llamadas = new AtomicInteger();

        ProveedorFijo(String respuesta) {
            this.respuesta = respuesta;
        }

        @Override public boolean disponible() { return true; }
        @Override public String nombre() { return "fijo"; }

        @Override
        public Optional<com.fasterxml.jackson.databind.JsonNode> completarJson(String i, String c) {
            llamadas.incrementAndGet();
            try {
                return Optional.of(MAPPER.readTree("{\"valor\": " + respuesta + "}"));
            } catch (Exception e) {
                return Optional.empty();
            }
        }
    }

    private static final Set<String> CAMPOS = DestinoDeHoja.PARTICIPANTES.camposPosibles();

    @Test
    void aceptaUnCampoCamelCaseYDevuelveElNombreCanonico() {
        var ia = new ReconocimientoConIa(new ProveedorFijo("\"nombreCompleto\""));

        assertEquals(Optional.of("nombreCompleto"), ia.sugerirCampo("Nombre y apellido", CAMPOS));
    }

    /** El modelo no siempre respeta el camelCase que se le pasó. */
    @Test
    void aceptaElCampoAunqueLaIaCambieLasMayusculas() {
        assertEquals(Optional.of("cargoObjetivo"),
                new ReconocimientoConIa(new ProveedorFijo("\"cargoobjetivo\""))
                        .sugerirCampo("Puestos a los que aplica", CAMPOS));
        assertEquals(Optional.of("areaFormacion"),
                new ReconocimientoConIa(new ProveedorFijo("\"AREAFORMACION\""))
                        .sugerirCampo("Estudios", CAMPOS));
    }

    /** La IA sugiere; el sistema valida. Un campo inventado no pasa. */
    @Test
    void rechazaUnCampoQueNoExisteEnElVocabulario() {
        var ia = new ReconocimientoConIa(new ProveedorFijo("\"salarioDeseado\""));

        assertTrue(ia.sugerirCampo("Aspiración salarial", CAMPOS).isEmpty());
    }

    @Test
    void unValorNuloNoEsUnaSugerencia() {
        var ia = new ReconocimientoConIa(new ProveedorFijo("null"));

        assertTrue(ia.sugerirCampo("Columna sin sentido", CAMPOS).isEmpty());
    }

    /**
     * El mismo titulo siempre da el mismo campo: repetir la consulta gasta una
     * llamada y unos segundos para recibir la respuesta que ya se tenia.
     */
    @Test
    void noVuelveAPreguntarPorUnTituloYaResuelto() {
        var proveedor = new ProveedorFijo("\"nombreCompleto\"");
        var ia = new ReconocimientoConIa(proveedor);

        ia.sugerirCampo("Nombre y apellido", CAMPOS);
        ia.sugerirCampo("nombre y apellido", CAMPOS);
        ia.sugerirCampo("  Nombre y Apellido  ", CAMPOS);

        assertEquals(1, proveedor.llamadas.get(), "el título ya estaba resuelto");
    }

    /** Recordar el «no» importa tanto como el «sí»: si no, se pregunta siempre. */
    @Test
    void tambienRecuerdaQueUnTituloNoCorrespondeANingunCampo() {
        var proveedor = new ProveedorFijo("null");
        var ia = new ReconocimientoConIa(proveedor);

        ia.sugerirCampo("Columna de relleno", CAMPOS);
        ia.sugerirCampo("Columna de relleno", CAMPOS);

        assertEquals(1, proveedor.llamadas.get());
    }

    @Test
    void sinTituloOSinVocabularioNoSeGastaUnaLlamada() {
        var proveedor = new ProveedorFijo("\"nombreCompleto\"");
        var ia = new ReconocimientoConIa(proveedor);

        assertTrue(ia.sugerirCampo(null, CAMPOS).isEmpty());
        assertTrue(ia.sugerirCampo("   ", CAMPOS).isEmpty());
        assertTrue(ia.sugerirCampo("Nombre", Set.of()).isEmpty());
        assertEquals(0, proveedor.llamadas.get());
    }

    /**
     * Guarda contra la regresión: si el vocabulario vuelve a compararse en
     * minúsculas, la mayoría de los campos deja de ser alcanzable.
     */
    @Test
    void todoElVocabularioEsAlcanzable() {
        for (DestinoDeHoja destino : DestinoDeHoja.values()) {
            for (String campo : destino.camposPosibles()) {
                var ia = new ReconocimientoConIa(new ProveedorFijo("\"" + campo + "\""));
                assertEquals(Optional.of(campo),
                        ia.sugerirCampo("columna " + campo, destino.camposPosibles()),
                        () -> "campo inalcanzable: " + campo + " en " + destino);
            }
        }
    }
}
