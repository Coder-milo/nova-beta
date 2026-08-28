package com.novacrm.scraper.fuente;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Traduccion del tablero de Arbeitnow, la fuente del segmento de migracion.
 */
class ArbeitnowConnectorTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ArbeitnowConnector conector;

    @BeforeEach
    void configurar() {
        conector = new ArbeitnowConnector(true, true);
    }

    private com.fasterxml.jackson.databind.JsonNode oferta(String json) throws Exception {
        return MAPPER.readTree(json);
    }

    @Test
    void sirveAlSegmentoDeMigracion() {
        assertEquals(Segmento.MIGRACION, conector.segmento());
    }

    /**
     * Una plaza en Berlin sin patrocinio de visa no es una oportunidad para
     * alguien en Barranquilla: es ruido que compite por el cupo de
     * recomendaciones.
     */
    private static final long EPOCH_FRESCO = java.time.Instant.now().minusSeconds(86400).getEpochSecond();

    @Test
    void descartaLasOfertasSinPatrocinioDeVisa() throws Exception {
        assertTrue(conector.mapear(oferta("""
                {"slug": "sin-visa", "title": "Backend Engineer", "visa_sponsorship": false, "created_at": %d}
                """.formatted(EPOCH_FRESCO))).isEmpty());

        assertTrue(conector.mapear(oferta("""
                {"slug": "con-visa", "title": "Backend Engineer", "visa_sponsorship": true, "created_at": %d}
                """.formatted(EPOCH_FRESCO))).isPresent());
    }

    @Test
    void sePuedeApagarElFiltroDeVisa() throws Exception {
        var sinFiltro = new ArbeitnowConnector(true, false);

        assertTrue(sinFiltro.mapear(oferta("""
                {"slug": "sin-visa", "title": "Backend Engineer", "visa_sponsorship": false, "created_at": %d}
                """.formatted(EPOCH_FRESCO))).isPresent());
    }

    @Test
    void mapeaLoEsencialDeLaOferta() throws Exception {
        var resultado = conector.mapear(oferta("""
                {
                  "slug": "customer-support-berlin-123",
                  "title": "Customer Support Specialist",
                  "company_name": "Acme GmbH",
                  "location": "Berlin",
                  "description": "<p>Great <b>team</b></p>",
                  "remote": false,
                  "visa_sponsorship": true,
                  "job_types": ["full_time"],
                  "url": "https://www.arbeitnow.com/jobs/customer-support-berlin-123",
                  "created_at": %d
                }
                """.formatted(EPOCH_FRESCO))).orElseThrow();

        var vacante = resultado.vacante();
        assertEquals("Customer Support Specialist", vacante.getTitulo());
        assertEquals("Acme GmbH", resultado.nombreEmpresa());
        assertEquals("Berlin", vacante.getUbicacion());
        assertEquals(Segmento.MIGRACION, vacante.getSegmento());
        assertEquals("full_time", vacante.getJornada());
        assertNotNull(vacante.getFechaPublicacion());
        assertTrue(FiltroFrescura.esFresca(vacante.getFechaPublicacion()));
        assertEquals("Great team", vacante.getDescripcion(),
                "la descripcion viene en HTML y alimenta la comparacion de terminos");
    }

    @Test
    void unaOfertaSinSlugOSinTituloOSinFechaSeDescarta() throws Exception {
        assertTrue(conector.mapear(oferta("""
                {"title": "Sin slug", "visa_sponsorship": true, "created_at": %d}
                """.formatted(EPOCH_FRESCO))).isEmpty());
        assertTrue(conector.mapear(oferta("""
                {"slug": "sin-titulo", "visa_sponsorship": true, "created_at": %d}
                """.formatted(EPOCH_FRESCO))).isEmpty());
        assertTrue(conector.mapear(oferta("""
                {"slug": "sin-fecha", "title": "Backend Engineer", "visa_sponsorship": true}
                """)).isEmpty());
    }

    @Test
    void descartaOfertasConFechaMayorA7Dias() throws Exception {
        long epochViejo = java.time.Instant.now().minusSeconds(30 * 86400L).getEpochSecond();
        assertTrue(conector.mapear(oferta("""
                {"slug": "oferta-vieja", "title": "Old Engineer", "visa_sponsorship": true, "created_at": %d}
                """.formatted(epochViejo))).isEmpty());
    }

    @Test
    void unaRespuestaSinOfertasNoEsUnFallo() throws Exception {
        assertTrue(conector.procesar("{}").isEmpty());
    }

    /** El tablero devuelve la pagina completa; pedirlo mas de una vez es tirar red. */
    @Test
    void bastaUnaConsultaPorCorrida() {
        assertEquals(1, conector.maximoConsultasPorCorrida());
        assertFalse(conector.filtraPorCiudad());
    }

    @Test
    void sePuedeDesactivarPorConfiguracion() {
        var desactivado = new ArbeitnowConnector(false, true);
        var resultado = desactivado.buscar("customer service", null);

        assertFalse(desactivado.estaHabilitada());
        assertTrue(resultado.ofertas().isEmpty());
        assertFalse(resultado.fallo(), "estar apagada no es un fallo que reportar");
    }
}
