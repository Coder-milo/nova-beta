package com.novacrm.scraper.portal;

import com.novacrm.scraper.fuente.Segmento;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ElempleoScraperTest {

    private ElempleoScraper scraper;

    @BeforeEach
    void setUp() {
        scraper = new ElempleoScraper(true);
    }

    @Test
    void verificaNombreYSegmento() {
        assertEquals("ELEMPLEO", scraper.nombre());
        assertEquals(Segmento.LOCAL_COLOMBIA, scraper.segmento());
        assertFalse(scraper.filtraPorCiudad());
        assertTrue(scraper.estaHabilitada());
    }

    @Test
    void deshabilitadoDevuelveResultadoVacio() {
        ElempleoScraper desactivado = new ElempleoScraper(false);
        assertFalse(desactivado.estaHabilitada());
        var res = desactivado.buscar("asesor", "Barranquilla");
        assertTrue(res.ofertas().isEmpty());
        assertFalse(res.fallo());
    }

    @Test
    void parseaOfertaRealConDataGa4() {
        var doc = Jsoup.parse("""
                <div class="result-item js-area-bind" data-url="/co/ofertas-trabajo/asesor-servicio-al-cliente/1885400"
                     data-ga4-offerdata='{"id":"1885400","title":"Asesor Servicio al Cliente Bilingue","company":"Teleperformance Colombia","location":"Barranquilla, Atlantico","salary":"$ 2.500.000 a $ 3.000.000","publishDate":"2026-08-24T10:00:00","equivalentPositions":["Customer Service","Call Center"],"tags":["Ingles B2","Remoto"]}'>
                    <h3>Asesor Servicio al Cliente Bilingue</h3>
                </div>
                """);

        var ofertas = ElempleoScraper.parsear(doc);

        assertEquals(1, ofertas.size());
        var vacante = ofertas.get(0).vacante();
        assertEquals("Asesor Servicio al Cliente Bilingue", vacante.getTitulo());
        assertEquals("Teleperformance Colombia", ofertas.get(0).nombreEmpresa());
        assertEquals("Barranquilla, Atlantico", vacante.getUbicacion());
        assertEquals("Barranquilla", vacante.getCiudad());
        assertEquals("$ 2.500.000 a $ 3.000.000", vacante.getRangoSalarial());
        assertTrue(vacante.getDescripcion().contains("Customer Service"));
        assertTrue(vacante.getDescripcion().contains("Ingles B2"));
        assertEquals("https://www.elempleo.com/co/ofertas-trabajo/asesor-servicio-al-cliente/1885400", vacante.getUrlOrigen());
        assertEquals("https://www.elempleo.com/co/ofertas-trabajo/asesor-servicio-al-cliente/1885400", vacante.getUrlAplicar());
        assertNotNull(vacante.getFechaPublicacion());
        assertTrue(com.novacrm.scraper.fuente.FiltroFrescura.esFresca(vacante.getFechaPublicacion()));
    }

    @Test
    void descartaOfertasConFechaAntiguaOSinFecha() {
        var doc = Jsoup.parse("""
                <div class="result-item js-area-bind" data-url="/co/oferta/1"
                     data-ga4-offerdata='{"id":"1","title":"Oferta Vieja","publishDate":"2025-01-01T00:00:00"}'>
                </div>
                <div class="result-item js-area-bind" data-url="/co/oferta/2"
                     data-ga4-offerdata='{"id":"2","title":"Oferta Sin Fecha"}'>
                </div>
                """);

        var ofertas = ElempleoScraper.parsear(doc);
        assertTrue(ofertas.isEmpty(), "las ofertas sin fecha o con fecha > 7 días deben ser descartadas");
    }
}
