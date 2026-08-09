package com.novacrm.scraper.fuente;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El conector con los portales de empleo de los propios empleadores.
 *
 * <p>La muestra reproduce la forma real de la respuesta de SmartRecruiters,
 * comprobada contra la API antes de escribir el conector: la consulta a
 * Sutherland con {@code country=co} devolvia 48 ofertas, 10 de ellas en
 * Barranquilla. Sin red en las pruebas: lo que se verifica es el mapeo y el
 * filtro, no que la API responda.
 */
class SmartRecruitersConnectorTest {

    private final SmartRecruitersConnector conector =
            new SmartRecruitersConnector(true, "Sutherland");

    /** Dos ofertas cercanas, una en Bogota y una sin ciudad. */
    private static final String RESPUESTA = """
            {
              "totalFound": 4,
              "content": [
                {
                  "id": "abc-111",
                  "name": "Bilingual Customer Service Representative",
                  "releasedDate": "2026-08-01T10:00:00.000Z",
                  "location": { "city": "Barranquilla", "region": "Atlántico" },
                  "typeOfEmployment": { "label": "Full-time" }
                },
                {
                  "id": "abc-222",
                  "name": "Agente de soporte",
                  "releasedDate": "2026-08-02T10:00:00.000Z",
                  "location": { "city": "Soledad", "region": "Atlántico" }
                },
                {
                  "id": "abc-333",
                  "name": "Practicante Área de Nómina",
                  "location": { "city": "Bogotá", "region": "Bogota D.C." }
                },
                {
                  "id": "abc-444",
                  "name": "Oferta sin ubicación declarada",
                  "location": {}
                }
              ]
            }
            """;

    @Test
    @DisplayName("se queda con lo que le sirve a la cohorte y descarta Bogotá")
    void filtraPorAreaMetropolitana() throws Exception {
        var ofertas = conector.procesar(RESPUESTA, "Sutherland");

        assertThat(ofertas)
                .extracting(o -> o.vacante().getTitulo())
                .containsExactlyInAnyOrder(
                        "Bilingual Customer Service Representative",
                        "Agente de soporte",
                        "Oferta sin ubicación declarada");
    }

    @Test
    @DisplayName("una oferta sin ciudad no se descarta")
    void laOfertaSinCiudadNoSeDescarta() {
        // Puede ser remota o venir sin el dato. Filtrar de más es peor que
        // filtrar de menos: lo que se pierde así no se ve por ninguna parte.
        assertThat(AreaMetropolitana.esCercana(null, null)).isTrue();
        assertThat(AreaMetropolitana.esCercana("", "")).isTrue();
    }

    @Test
    @DisplayName("reconoce el municipio aunque venga con tilde o en otra caja")
    void reconoceElMunicipioSinImportarComoVengaEscrito() {
        assertThat(AreaMetropolitana.esCercana("BARRANQUILLA", null)).isTrue();
        assertThat(AreaMetropolitana.esCercana("Barránquilla", null)).isTrue();
        assertThat(AreaMetropolitana.esCercana(null, "Atlántico")).isTrue();
        assertThat(AreaMetropolitana.esCercana("Medellín", "Antioquia")).isFalse();
    }

    @Test
    @DisplayName("la oferta trae empresa, enlace y entra ya revisada")
    void mapeaLosDatosQueElMatchingNecesita() throws Exception {
        var oferta = conector.procesar(RESPUESTA, "Sutherland").stream()
                .filter(o -> o.vacante().getTitulo().startsWith("Bilingual"))
                .findFirst()
                .orElseThrow();

        assertThat(oferta.nombreEmpresa()).isEqualTo("Sutherland");
        assertThat(oferta.vacante().getCiudad()).isEqualTo("Barranquilla");
        assertThat(oferta.vacante().getUbicacion()).isEqualTo("Barranquilla, Atlántico");
        assertThat(oferta.vacante().getFuente()).isEqualTo("SMARTRECRUITERS");
        assertThat(oferta.vacante().getSegmento()).isEqualTo(Segmento.LOCAL_COLOMBIA);
        assertThat(oferta.vacante().getUrlAplicar()).contains("jobs.smartrecruiters.com");
        assertThat(oferta.vacante().getTipoContrato()).isEqualTo("Full-time");
        assertThat(oferta.vacante().isRevisada())
                .as("la publica el propio empleador, no un tercero")
                .isTrue();
        assertThat(oferta.vacante().getFechaPublicacion()).isNotNull();
    }

    @Test
    @DisplayName("sin empresas configuradas la fuente se apaga sola")
    void sinEmpresasSeApaga() {
        assertThat(new SmartRecruitersConnector(true, "  ").estaHabilitada()).isFalse();
        assertThat(new SmartRecruitersConnector(false, "Sutherland").estaHabilitada()).isFalse();
    }

    @Test
    @DisplayName("una respuesta vacía o rota no revienta la corrida")
    void unaRespuestaRotaNoRevienta() throws Exception {
        assertThat(conector.procesar("{\"content\":[]}", "Sutherland")).isEmpty();
        assertThat(conector.procesar("{}", "Sutherland")).isEmpty();
    }
}
