package com.novacrm.scraper.portal;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Traduccion de las ofertas de la API de Remotive al modelo propio.
 *
 * <p>Se ejercita sobre el JSON tal y como lo documenta Remotive, sin llamar a
 * la red: la parte fragil no es la peticion, sino decidir que ofertas sirven y
 * como se convierten.
 */
class RemotiveConnectorTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private RemotiveConnector conector;

    @BeforeEach
    void configurar() {
        conector = new RemotiveConnector(true);
    }

    private com.fasterxml.jackson.databind.JsonNode oferta(String json) throws Exception {
        return MAPPER.readTree(json);
    }

    @Test
    void mapeaUnaOfertaCompleta() throws Exception {
        var json = oferta("""
                {
                  "id": 1234567,
                  "url": "https://remotive.com/remote-jobs/customer-support/bilingual-csr-1234567",
                  "title": "Bilingual Customer Support Representative",
                  "company_name": "Acme BPO",
                  "category": "Customer Service",
                  "job_type": "full_time",
                  "publication_date": "2026-07-20T10:30:00",
                  "candidate_required_location": "LATAM",
                  "salary": "$1,200 - $1,600 USD/month",
                  "description": "<p>You will <strong>answer calls</strong> in English.</p>"
                }
                """);

        var vacante = conector.mapear(json).orElseThrow();

        assertEquals("Bilingual Customer Support Representative", vacante.getTitulo());
        assertEquals("REMOTIVE", vacante.getFuente());
        assertEquals("LATAM", vacante.getUbicacion());
        assertEquals("REMOTO", vacante.getModalidadTrabajo());
        assertEquals("full_time", vacante.getTipoContrato());
        assertEquals("$1,200 - $1,600 USD/month", vacante.getRangoSalarial());
        assertTrue(vacante.isActivo());
        assertNotNull(vacante.getHashDedup());
    }

    /** Las condiciones de uso exigen enlazar de vuelta a la oferta original. */
    @Test
    void conservaElEnlaceALaOfertaOriginal() throws Exception {
        var json = oferta("""
                {"id": 42, "title": "CSR", "url": "https://remotive.com/remote-jobs/x-42",
                 "candidate_required_location": "Worldwide"}
                """);

        var vacante = conector.mapear(json).orElseThrow();

        assertEquals("https://remotive.com/remote-jobs/x-42", vacante.getUrlOrigen());
        assertEquals("https://remotive.com/remote-jobs/x-42", vacante.getUrlAplicar());
    }

    /** La descripcion llega en HTML y alimenta la comparacion de terminos. */
    @Test
    void guardaLaDescripcionEnTextoPlano() throws Exception {
        var json = oferta("""
                {"id": 7, "title": "Agent", "candidate_required_location": "Worldwide",
                 "description": "<ul><li>Handle <b>inbound</b> calls</li></ul>"}
                """);

        var vacante = conector.mapear(json).orElseThrow();

        assertFalse(vacante.getDescripcion().contains("<"), "no debe quedar marcado HTML");
        assertTrue(vacante.getDescripcion().contains("inbound"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "Worldwide", "Anywhere", "LATAM", "Latin America",
            "Colombia", "Americas", "South America"
    })
    void admiteLasRegionesDesdeLasQueSePuedeTrabajarEnColombia(String region) {
        assertTrue(RemotiveConnector.admiteCandidatoEnColombia(region));
    }

    /**
     * Una oferta restringida a otro pais no le sirve a un participante y solo
     * ensuciaria las recomendaciones.
     */
    @ParameterizedTest
    @ValueSource(strings = {"USA Only", "UK", "Germany", "Canada", "EMEA", "India"})
    void descartaLasOfertasRestringidasAOtrasRegiones(String region) {
        assertFalse(RemotiveConnector.admiteCandidatoEnColombia(region));
    }

    @Test
    void descartaLaOfertaCuandoLaRegionNoAdmiteACandidatosDeColombia() throws Exception {
        var json = oferta("""
                {"id": 99, "title": "Support Agent", "candidate_required_location": "USA Only"}
                """);

        assertTrue(conector.mapear(json).isEmpty());
    }

    @Test
    void sinRegionDeclaradaSeAsumeAbierta() throws Exception {
        var json = oferta("""
                {"id": 100, "title": "Support Agent"}
                """);

        assertTrue(conector.mapear(json).isPresent());
        assertEquals("Remoto", conector.mapear(json).orElseThrow().getUbicacion());
    }

    @Test
    void descartaOfertasSinIdOSinTitulo() throws Exception {
        assertTrue(conector.mapear(oferta("""
                {"title": "Sin id", "candidate_required_location": "Worldwide"}
                """)).isEmpty());
        assertTrue(conector.mapear(oferta("""
                {"id": 5, "candidate_required_location": "Worldwide"}
                """)).isEmpty());
    }

    /** El hash evita volver a guardar la misma oferta en la corrida siguiente. */
    @Test
    void laMismaOfertaProduceSiempreElMismoHash() throws Exception {
        var json = oferta("""
                {"id": 555, "title": "CSR", "candidate_required_location": "Worldwide"}
                """);

        assertEquals(conector.mapear(json).orElseThrow().getHashDedup(),
                conector.mapear(json).orElseThrow().getHashDedup());
    }

    @Test
    void ofertasDistintasNoColisionan() throws Exception {
        var una = conector.mapear(oferta("""
                {"id": 1, "title": "CSR", "candidate_required_location": "Worldwide"}
                """)).orElseThrow();
        var otra = conector.mapear(oferta("""
                {"id": 2, "title": "CSR", "candidate_required_location": "Worldwide"}
                """)).orElseThrow();

        assertNotEquals(una.getHashDedup(), otra.getHashDedup());
    }

    /**
     * Un cuerpo ilegible es un fallo de la fuente, no una busqueda sin
     * resultados: el contrato distingue los dos casos para que una corrida rota
     * se vea rota en el panel.
     */
    @Test
    void unaRespuestaIlegibleSeReportaComoFallo() {
        var resultado = conector.procesar("esto no es json");

        assertTrue(resultado.fallo(), "una respuesta ilegible tiene que reportarse");
        assertTrue(resultado.ofertas().isEmpty());
    }

    @Test
    void unaRespuestaSinOfertasNoEsUnFallo() {
        var resultado = conector.procesar("{}");

        assertFalse(resultado.fallo(), "no encontrar nada es un resultado valido");
        assertTrue(resultado.ofertas().isEmpty());
    }

    @Test
    void sePuedeDesactivarPorConfiguracion() {
        var desactivado = new RemotiveConnector(false);
        var resultado = desactivado.buscar("customer service", null);

        assertTrue(resultado.ofertas().isEmpty(), "desactivado no debe salir a la red");
        assertFalse(resultado.fallo(), "estar apagada no es un fallo que reportar");
        assertFalse(desactivado.estaHabilitada());
    }

    /**
     * El tablero es el mismo para cualquier ciudad, asi que la fuente declara
     * que no filtra por ella: es lo que evita las cinco peticiones identicas
     * por termino que disparaba el bucle termino×ciudad.
     */
    @Test
    void noFiltraPorCiudad() {
        assertFalse(conector.filtraPorCiudad());
    }
}
