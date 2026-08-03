package com.novacrm.scraper;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Terminos con los que se rastrean los portales.
 *
 * <p>Antes eran cinco palabras fijas de perfil tecnico ("desarrollador",
 * "ingeniero", "analista"...) y la ciudad "Bogota". La poblacion real del
 * programa apunta mayoritariamente a BPO y servicio al cliente bilingue, y
 * reside en la costa: el rastreo traia ofertas que nadie podia aprovechar.
 */
class TerminosDeBusquedaTest {

    @Test
    void tomaLosTerminosDeLoQueDeclararonLosEstudiantes() {
        var terminos = TerminosDeBusqueda.desdeEstudiantes(
                List.of("Bilingual Customer Service Representative"),
                List.of("BPO / Servicios tercerizados"));

        assertTrue(terminos.stream().anyMatch(t -> t.contains("customer service")),
                () -> "deberia buscar por el cargo declarado, fue " + terminos);
        assertTrue(terminos.stream().anyMatch(t -> t.contains("bpo")),
                () -> "deberia buscar por el sector declarado, fue " + terminos);
    }

    /** Un mismo campo trae varias opciones separadas por barra o coma. */
    @Test
    void separaLasOpcionesDeUnMismoCampo() {
        var partes = TerminosDeBusqueda.trocear(
                "Customer Service Representative / Sales Agent, Data Entry");

        assertEquals(3, partes.size(), () -> "fue " + partes);
        assertTrue(partes.contains("data entry"));
    }

    @Test
    void normalizaTildesYMayusculas() {
        var partes = TerminosDeBusqueda.trocear("Atención al Cliente");

        assertEquals(List.of("atencion al cliente"), partes);
    }

    /** Las frases largas devuelven poco en los portales. */
    @Test
    void recortaLasFrasesDemasiadoLargas() {
        var partes = TerminosDeBusqueda.trocear(
                "Bilingual Customer Service Representative for International Accounts Division");

        assertEquals(1, partes.size());
        assertEquals(4, partes.get(0).split(" ").length,
                () -> "deberia quedarse en cuatro palabras, fue '" + partes.get(0) + "'");
    }

    @Test
    void descartaLosFragmentosDemasiadoCortos() {
        var partes = TerminosDeBusqueda.trocear("BPO / y / de");

        assertEquals(List.of("bpo"), partes);
    }

    @Test
    void limitaCuantosTerminosSeConsultan() {
        var muchos = List.of("uno", "dos", "tres", "cuatro", "cinco",
                "seis", "siete", "ocho", "nueve", "diez");

        var terminos = TerminosDeBusqueda.desdeEstudiantes(muchos, muchos);

        assertTrue(terminos.size() <= TerminosDeBusqueda.MAX_TERMINOS,
                "cada termino es una peticion mas al portal");
    }

    @Test
    void noRepiteTerminos() {
        var terminos = TerminosDeBusqueda.desdeEstudiantes(
                List.of("Customer Service", "customer service"),
                List.of("CUSTOMER SERVICE"));

        assertEquals(1, terminos.size(), () -> "fue " + terminos);
    }

    /** Con la base recien montada todavia no hay de donde deducirlos. */
    @Test
    void usaElRespaldoCuandoNoHayEstudiantes() {
        assertEquals(TerminosDeBusqueda.RESPALDO,
                TerminosDeBusqueda.desdeEstudiantes(List.of(), List.of()));
        assertEquals(TerminosDeBusqueda.RESPALDO,
                TerminosDeBusqueda.desdeEstudiantes(null, null));
    }

    @Test
    void buscaEnLasCiudadesDondeHayEstudiantes() {
        var ciudades = TerminosDeBusqueda.ciudades(
                List.of("Barranquilla", "Soledad", "Barranquilla"));

        assertEquals(List.of("Barranquilla", "Soledad"), ciudades,
                "sin repetir, y en orden de frecuencia");
    }

    @Test
    void sinCiudadesRegistradasBuscaANivelNacional() {
        assertEquals(List.of(TerminosDeBusqueda.CIUDAD_POR_DEFECTO),
                TerminosDeBusqueda.ciudades(List.of()));
        assertEquals(List.of(TerminosDeBusqueda.CIUDAD_POR_DEFECTO),
                TerminosDeBusqueda.ciudades(null));
    }
}
