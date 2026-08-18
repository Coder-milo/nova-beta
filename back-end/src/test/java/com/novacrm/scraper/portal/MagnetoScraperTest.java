package com.novacrm.scraper.portal;

import com.novacrm.scraper.fuente.Segmento;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MagnetoScraperTest {

    private MagnetoScraper scraper;

    @BeforeEach
    void setUp() {
        scraper = new MagnetoScraper(true);
    }

    @Test
    void verificaNombreYSegmento() {
        assertEquals("MAGNETO", scraper.nombre());
        assertEquals(Segmento.LOCAL_COLOMBIA, scraper.segmento());
        assertTrue(scraper.filtraPorCiudad());
        assertTrue(scraper.estaHabilitada());
    }

    @Test
    void deshabilitadoDevuelveResultadoVacio() {
        MagnetoScraper desactivado = new MagnetoScraper(false);
        assertFalse(desactivado.estaHabilitada());
        var res = desactivado.buscar("call center", "Barranquilla");
        assertTrue(res.ofertas().isEmpty());
        assertFalse(res.fallo());
    }
}
