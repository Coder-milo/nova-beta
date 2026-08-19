package com.novacrm.scraper.portal;

import com.novacrm.scraper.fuente.Segmento;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JoobleConnectorTest {

    @Test
    void verificaMetadatosConector() {
        JoobleConnector connector = new JoobleConnector(true, "fake-api-key");
        assertEquals("JOOBLE", connector.nombre());
        assertEquals(Segmento.LOCAL_COLOMBIA, connector.segmento());
        assertTrue(connector.filtraPorCiudad());
        assertTrue(connector.estaHabilitada());
        assertEquals(6, connector.maximoConsultasPorCorrida());
    }

    @Test
    void sinApiKeyPermaneceDeshabilitadoSinFallar() {
        JoobleConnector connector = new JoobleConnector(true, "");
        assertFalse(connector.estaHabilitada());
        var res = connector.buscar("bilingue", "Barranquilla");
        assertTrue(res.ofertas().isEmpty());
        assertFalse(res.fallo());
    }
}
