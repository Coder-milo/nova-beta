package com.novacrm.scraper.fuente;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Traduccion de las ofertas de JSearch al modelo propio.
 *
 * <p>Sobre el JSON tal como lo documenta la API, sin llamar a la red: lo fragil
 * no es la peticion sino el mapeo, y esta es la unica fuente que trae los
 * campos que hasta ahora faltaban en el 100% de las vacantes automaticas.
 */
class JSearchConnectorTest {

    private static final com.fasterxml.jackson.databind.ObjectMapper MAPPER =
            new com.fasterxml.jackson.databind.ObjectMapper();

    private ControlDeCuota controlDeCuota;
    private JSearchConnector conector;

    @BeforeEach
    void configurar() {
        controlDeCuota = mock(ControlDeCuota.class);
        when(controlDeCuota.intentarConsumir(anyString(), anyInt())).thenReturn(true);
        conector = new JSearchConnector(controlDeCuota, "clave-de-prueba", true, 200, 6, "co");
    }

    private com.fasterxml.jackson.databind.JsonNode oferta(String json) throws Exception {
        return MAPPER.readTree(json);
    }

    @Test
    void sirveAlSegmentoLocalDeColombia() {
        assertEquals(Segmento.LOCAL_COLOMBIA, conector.segmento());
        assertTrue(conector.filtraPorCiudad(),
                "la ciudad cambia los resultados, asi que vale la pena gastar una consulta por cada una");
    }

    /**
     * Es la unica fuente que separa los requisitos del cuerpo del anuncio. De
     * ahi salen el nivel de ingles y los anios de experiencia, los dos
     * criterios que eran constantes para todas las vacantes automaticas.
     */
    private static final String FECHA_FRESCA = java.time.LocalDateTime.now().minusDays(1).toString() + "Z";

    @Test
    void traeLosRequisitosQueNingunaOtraFuenteDa() throws Exception {
        var resultado = conector.mapear(oferta("""
                {
                  "job_id": "abc123",
                  "job_title": "Agente Bilingue de Servicio al Cliente",
                  "employer_name": "Teleperformance Colombia",
                  "job_city": "Barranquilla",
                  "job_state": "Atlantico",
                  "job_country": "CO",
                  "job_posted_at_datetime_utc": "%s",
                  "job_highlights": {
                    "Qualifications": [
                      "Ingles B2 conversacional",
                      "Minimo 1 ano de experiencia en call center"
                    ]
                  }
                }
                """.formatted(FECHA_FRESCA))).orElseThrow();

        assertTrue(resultado.vacante().getRequisitos().contains("Ingles B2 conversacional"));
        assertTrue(resultado.vacante().getRequisitos().contains("Minimo 1 ano"));
        assertEquals("Teleperformance Colombia", resultado.nombreEmpresa());
        assertEquals("Barranquilla", resultado.vacante().getCiudad());
        assertEquals("Barranquilla, Atlantico, CO", resultado.vacante().getUbicacion());
        assertEquals(Segmento.LOCAL_COLOMBIA, resultado.vacante().getSegmento());
        assertNotNull(resultado.vacante().getFechaPublicacion());
        assertTrue(FiltroFrescura.esFresca(resultado.vacante().getFechaPublicacion()));
    }

    /** Sin fecha de expiracion las vacantes automaticas no vencian nunca. */
    @Test
    void mapeaLaFechaDeExpiracion() throws Exception {
        var resultado = conector.mapear(oferta("""
                {
                  "job_id": "abc123",
                  "job_title": "Auxiliar de bodega",
                  "job_posted_at_datetime_utc": "%s",
                  "job_offer_expiration_datetime_utc": "2026-08-30T10:00:00.000Z"
                }
                """.formatted(FECHA_FRESCA))).orElseThrow();

        assertNotNull(resultado.vacante().getFechaExpiracion());
        assertEquals(2026, resultado.vacante().getFechaExpiracion().getYear());
        assertEquals(8, resultado.vacante().getFechaExpiracion().getMonthValue());
        assertNotNull(resultado.vacante().getFechaPublicacion());
        assertTrue(FiltroFrescura.esFresca(resultado.vacante().getFechaPublicacion()));
    }

    @Test
    void unaOfertaSinIdOSinTituloOSinFechaSeDescarta() throws Exception {
        assertTrue(conector.mapear(oferta("""
                {"job_title": "Sin id", "job_posted_at_datetime_utc": "%s"}
                """.formatted(FECHA_FRESCA))).isEmpty());
        assertTrue(conector.mapear(oferta("""
                {"job_id": "sin-titulo", "job_posted_at_datetime_utc": "%s"}
                """.formatted(FECHA_FRESCA))).isEmpty());
        assertTrue(conector.mapear(oferta("""
                {"job_id": "sin-fecha", "job_title": "Auxiliar"}
                """)).isEmpty());
    }

    @Test
    void descartaOfertasConFechaMayorA7Dias() throws Exception {
        var stale = conector.mapear(oferta("""
                {
                  "job_id": "viejo123",
                  "job_title": "Auxiliar",
                  "job_posted_at_datetime_utc": "2025-01-01T10:00:00.000Z"
                }
                """));
        assertTrue(stale.isEmpty(), "oferta con más de 7 días debe descartarse");
    }

    @Test
    void dosOfertasDistintasNoComparteHash() throws Exception {
        var una = conector.mapear(oferta("""
                {"job_id": "uno", "job_title": "Agente", "job_posted_at_datetime_utc": "%s"}
                """.formatted(FECHA_FRESCA))).orElseThrow();
        var otra = conector.mapear(oferta("""
                {"job_id": "dos", "job_title": "Agente", "job_posted_at_datetime_utc": "%s"}
                """.formatted(FECHA_FRESCA))).orElseThrow();

        assertNotEquals(una.vacante().getHashDedup(), otra.vacante().getHashDedup());
    }

    @Test
    void reconoceLasOfertasRemotas() throws Exception {
        var remota = conector.mapear(oferta("""
                {"job_id": "uno", "job_title": "Agente", "job_is_remote": true, "job_posted_at_datetime_utc": "%s"}
                """.formatted(FECHA_FRESCA))).orElseThrow();
        var presencial = conector.mapear(oferta("""
                {"job_id": "dos", "job_title": "Agente", "job_is_remote": false, "job_posted_at_datetime_utc": "%s"}
                """.formatted(FECHA_FRESCA))).orElseThrow();

        assertEquals("REMOTO", remota.vacante().getModalidadTrabajo());
        assertEquals("PRESENCIAL", presencial.vacante().getModalidadTrabajo());
    }

    /**
     * La clave sale de la variable de entorno y nunca del repositorio. Sin ella
     * el conector se apaga en vez de gastar peticiones sin credencial.
     */
    @Test
    void sinClaveSeApagaSolo() {
        var sinClave = new JSearchConnector(controlDeCuota, "", true, 200, 6, "co");

        assertFalse(sinClave.estaHabilitada());
        assertTrue(sinClave.buscar("call center", "Barranquilla").ofertas().isEmpty());
        verify(controlDeCuota, never()).intentarConsumir(anyString(), anyInt());
    }

    /**
     * El cupo se reserva antes de llamar, no despues: el proveedor cobra la
     * peticion aunque no devuelva nada, asi que preguntarle primero a la base es
     * lo unico que evita quemar las 200 del mes en unos dias.
     */
    @Test
    void conElCupoAgotadoNoSaleALaRed() {
        when(controlDeCuota.intentarConsumir(anyString(), anyInt())).thenReturn(false);

        var resultado = conector.buscar("call center", "Barranquilla");

        assertTrue(resultado.fallo(), "quedarse sin cupo tiene que verse en el panel");
        assertTrue(resultado.error().contains("cupo"));
        // Se consulto el cupo, y como no habia, ahi se acabo: ninguna peticion.
        verify(controlDeCuota, times(1)).intentarConsumir("JSEARCH", 200);
    }

    @Test
    void declaraSuTopeDeConsultasPorCorrida() {
        assertEquals(6, conector.maximoConsultasPorCorrida(),
                "con cron diario, 6 por corrida son ~180 al mes: cabe en las 200");
    }

    /**
     * El sobre de openwebninja trae las ofertas anidadas: {@code data[]} son
     * paginas y cada una las tiene en {@code jobs[]}. Sin este desanidado la
     * fuente devoveria cero ofertas siempre, aunque la API responda bien.
     */
    @Test
    void procesaElSobreDeOpenwebninja() throws Exception {
        var resultado = conector.procesar("""
                {
                  "status": "OK",
                  "data": [
                    {
                      "jobs": [
                        {"job_id": "uno", "job_title": "Agente Bilingue", "job_posted_at_datetime_utc": "%s"},
                        {"job_id": "dos", "job_title": "Auxiliar de bodega", "job_posted_at_datetime_utc": "%s"}
                      ],
                      "cursor": "abc"
                    },
                    {
                      "jobs": [
                        {"job_id": "tres", "job_title": "Asesor comercial", "job_posted_at_datetime_utc": "%s"}
                      ]
                    }
                  ]
                }
                """.formatted(FECHA_FRESCA, FECHA_FRESCA, FECHA_FRESCA));

        assertEquals(3, resultado.size());
        assertEquals("Agente Bilingue", resultado.get(0).vacante().getTitulo());
        assertEquals("Asesor comercial", resultado.get(2).vacante().getTitulo());
    }

    @Test
    void procesaElSobreDeOpenwebninjaSearchV2() throws Exception {
        var resultado = conector.procesar("""
                {
                  "status": "OK",
                  "data": {
                    "jobs": [
                      {"job_id": "v2-1", "job_title": "Bilingual CSR", "job_posted_at_datetime_utc": "%s"},
                      {"job_id": "v2-2", "job_title": "Tech Support", "job_posted_at_datetime_utc": "%s"}
                    ],
                    "cursor": "cursor123"
                  }
                }
                """.formatted(FECHA_FRESCA, FECHA_FRESCA));

        assertEquals(2, resultado.size());
        assertEquals("Bilingual CSR", resultado.get(0).vacante().getTitulo());
        assertEquals("Tech Support", resultado.get(1).vacante().getTitulo());
    }
}
