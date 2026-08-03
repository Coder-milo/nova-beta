package com.novacrm.configuracion;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.ia.ProveedorIa;
import com.novacrm.scraper.fuente.ControlDeCuota;
import com.novacrm.scraper.fuente.FuenteDeVacantes;
import com.novacrm.scraper.fuente.ResultadoBusqueda;
import com.novacrm.scraper.fuente.Segmento;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Estado de las integraciones para la pantalla de configuración.
 *
 * <p>Lo que más importa probar aquí es lo que <em>no</em> sale: la pantalla
 * anterior guardaba la clave de Groq, el token de WhatsApp y la de JSearch en
 * {@code localStorage} —texto plano legible por cualquier script inyectado, el
 * mismo fallo que se corrigió para el JWT— y encima no servía de nada, porque
 * el backend lee esas credenciales de variables de entorno al arrancar.
 */
class IntegracionesServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String CLAVE = "gsk_secreto_que_no_debe_salir_jamas";

    private static ProveedorIa proveedor(boolean disponible, boolean responde) {
        return new ProveedorIa() {
            @Override public boolean disponible() { return disponible; }
            @Override public String nombre() { return "groq"; }
            @Override public Optional<JsonNode> completarJson(String i, String c) {
                try {
                    return responde ? Optional.of(MAPPER.readTree("{\"ok\": true}")) : Optional.empty();
                } catch (Exception e) {
                    return Optional.empty();
                }
            }
        };
    }

    private static FuenteDeVacantes fuente(String nombre, boolean habilitada) {
        return new FuenteDeVacantes() {
            @Override public String nombre() { return nombre; }
            @Override public Segmento segmento() { return Segmento.LOCAL_COLOMBIA; }
            @Override public boolean estaHabilitada() { return habilitada; }
            @Override public int maximoConsultasPorCorrida() { return 6; }
            @Override public ResultadoBusqueda buscar(String t, String c) { return ResultadoBusqueda.vacio(); }
        };
    }

    private static IntegracionesService servicio(ProveedorIa ia, ControlDeCuota cuota,
                                                 List<FuenteDeVacantes> fuentes) {
        return new IntegracionesService(ia, fuentes, cuota,
                "llama-3.3-70b-versatile", 200,
                "smtp.gmail.com", "equipo@cac.edu.co", "noreply@cac.edu.co",
                "http://localhost:9000", "novacrm", "minio-access");
    }

    private static ControlDeCuota cuotaCon(int restantes) {
        var cuota = mock(ControlDeCuota.class);
        when(cuota.restantes(anyString(), anyInt())).thenReturn(restantes);
        return cuota;
    }

    /** El guardián: ninguna credencial puede viajar al navegador. */
    @Test
    void ningunEstadoLlevaCredenciales() {
        var estados = servicio(proveedor(true, true), cuotaCon(150),
                List.of(fuente("JSEARCH", true))).listar();

        String serializado = estados.toString();
        assertFalse(serializado.contains(CLAVE), "la clave de la IA no puede salir");
        assertFalse(serializado.contains("minio-access"),
                "la clave de almacenamiento tampoco: solo endpoint y bucket");

        // Los NOMBRES de las variables sí salen —«SMTP_PASSWORD», «GROQ_API_KEY»—
        // y deben salir: sin decir dónde se pone cada cosa, el panel no sirve
        // para arreglar nada. Lo que no puede salir es su contenido, y por eso
        // el servicio ni siquiera recibe las contraseñas: solo lo que enseña.
        assertTrue(serializado.contains("SMTP_PASSWORD"));
        assertTrue(serializado.contains("GROQ_API_KEY"));
    }

    @Test
    void diceQueVariablesDeEntornoConfiguranCadaCosa() {
        var estados = servicio(proveedor(false, false), cuotaCon(200),
                List.of(fuente("JSEARCH", false))).listar();

        var ia = estados.stream().filter(e -> e.id().equals("ia")).findFirst().orElseThrow();
        assertTrue(ia.variablesEntorno().contains("GROQ_API_KEY"),
                "sin decir dónde se pone, el panel no sirve para arreglar nada");
        assertFalse(ia.configurada());
        assertTrue(ia.resumen().contains("siguen funcionando"),
                "sin IA el sistema no se rompe, y eso hay que decirlo");
    }

    @Test
    void avisaCuandoElCupoDeJsearchSeAgota() {
        var estados = servicio(proveedor(true, true), cuotaCon(0),
                List.of(fuente("JSEARCH", true))).listar();

        var jsearch = estados.stream()
                .filter(e -> e.id().equals("fuente-jsearch")).findFirst().orElseThrow();
        assertNotNull(jsearch.advertencia());
        assertTrue(jsearch.advertencia().contains("agotado"), jsearch.advertencia());
    }

    @Test
    void avisaCuandoQuedaPocoCupo() {
        var estados = servicio(proveedor(true, true), cuotaCon(5),
                List.of(fuente("JSEARCH", true))).listar();

        var jsearch = estados.stream()
                .filter(e -> e.id().equals("fuente-jsearch")).findFirst().orElseThrow();
        assertTrue(jsearch.advertencia().contains("10%"), jsearch.advertencia());
    }

    /** Elempleo lleva su advertencia legal esté encendido o apagado. */
    @Test
    void elempleoAvisaDeSusCondicionesDeUso() {
        var estados = servicio(proveedor(true, true), cuotaCon(200),
                List.of(fuente("ELEMPLEO", false))).listar();

        var elempleo = estados.stream()
                .filter(e -> e.id().equals("fuente-elempleo")).findFirst().orElseThrow();
        assertTrue(elempleo.advertencia().contains("condiciones de uso"), elempleo.advertencia());
    }

    /**
     * Probar JSearch gastaría una de las 200 peticiones del mes, que es justo
     * lo que el panel intenta cuidar.
     */
    @Test
    void lasFuentesConCupoNoSePrueban() {
        var servicio = servicio(proveedor(true, true), cuotaCon(200),
                List.of(fuente("JSEARCH", true)));

        var jsearch = servicio.listar().stream()
                .filter(e -> e.id().equals("fuente-jsearch")).findFirst().orElseThrow();
        assertFalse(jsearch.probable());
        assertFalse(servicio.probar("fuente-jsearch").exito());
    }

    @Test
    void laPruebaDeIaDistingueClaveAusenteDeFalloDelProveedor() {
        var sinClave = servicio(proveedor(false, false), cuotaCon(200), List.of());
        var prueba = sinClave.probar("ia");
        assertFalse(prueba.exito());
        assertTrue(prueba.mensaje().contains("GROQ_API_KEY"), prueba.mensaje());

        var noResponde = servicio(proveedor(true, false), cuotaCon(200), List.of());
        var fallo = noResponde.probar("ia");
        assertFalse(fallo.exito());
        assertTrue(fallo.mensaje().contains("cupo") || fallo.mensaje().contains("inválida"),
                fallo.mensaje());
    }

    @Test
    void laPruebaDeIaConfirmaCuandoElProveedorResponde() {
        var prueba = servicio(proveedor(true, true), cuotaCon(200), List.of()).probar("ia");

        assertTrue(prueba.exito());
        assertTrue(prueba.mensaje().contains("groq"), prueba.mensaje());
    }
}
