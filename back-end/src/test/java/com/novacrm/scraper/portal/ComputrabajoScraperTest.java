package com.novacrm.scraper.portal;

import com.novacrm.scraper.fuente.Segmento;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ComputrabajoScraperTest {

    private ComputrabajoScraper scraper;

    @BeforeEach
    void setUp() {
        scraper = new ComputrabajoScraper(true);
    }

    @Test
    void verificaNombreYSegmento() {
        assertEquals("COMPUTRABAJO", scraper.nombre());
        assertEquals(Segmento.LOCAL_COLOMBIA, scraper.segmento());
        assertTrue(scraper.filtraPorCiudad());
        assertTrue(scraper.estaHabilitada());
    }

    @Test
    void deshabilitadoDevuelveResultadoVacio() {
        ComputrabajoScraper desactivado = new ComputrabajoScraper(false);
        assertFalse(desactivado.estaHabilitada());
        var res = desactivado.buscar("asesor", "Barranquilla");
        assertTrue(res.ofertas().isEmpty());
        assertFalse(res.fallo());
    }

    /**
     * Parseo contra una tarjeta real capturada del portal (2026-08-12). Si el
     * portal cambia la estructura, esta prueba casca en vez de llenar la tabla
     * con campos vacios en silencio.
     */
    @Test
    void parseaLaTarjetaRealDelPortal() {
        var doc = Jsoup.parse("""
                <article class="box_offer sel " data-id='8858EC7E3D0C3C9761373E686DCF3405'>
                    <h2>
                        <a class="js-o-link fc_base" href="/ofertas-de-trabajo/asesor-comercial-8858EC7E3D0C3C9761373E686DCF3405">
                            Asesor Comercial con Atencion al cliente
                        </a>
                    </h2>
                    <p class="dFlex vm_fx fs16 fc_base mt5">
                        <span class="fwB">4,5</span>
                        <a class="fc_base t_ellipsis" href="https://co.computrabajo.com/emergia" offer-grid-article-company-url>
                            EMERGIA
                        </a>
                    </p>
                    <p class="fs16 fc_base mt5">
                        <span class="mr10">Manizales, Caldas</span>
                    </p>
                    <div class="fs13 mt15">
                        <span class="dIB mr10">
                            <span class="icon i_salary"></span>
                            $ 1.750.905,00 (Mensual)
                        </span>
                    </div>
                    <p class="fs13 fc_aux mt15">Hace 1 hora</p>
                </article>
                """);

        var ofertas = ComputrabajoScraper.parsear(doc, "Barranquilla");

        assertEquals(1, ofertas.size());
        var vacante = ofertas.get(0).vacante();
        assertEquals("Asesor Comercial con Atencion al cliente", vacante.getTitulo());
        assertEquals("EMERGIA", ofertas.get(0).nombreEmpresa());
        assertEquals("Manizales, Caldas", vacante.getUbicacion());
        assertEquals("Manizales", vacante.getCiudad());
        assertEquals("$ 1.750.905,00 (Mensual)", vacante.getRangoSalarial());
        assertEquals(vacante.getTitulo(), vacante.getDescripcion(),
                "sin descripcion en la tarjeta, el titulo es mejor que el ruido del card");
        assertNotNull(vacante.getFechaPublicacion());
        assertTrue(com.novacrm.scraper.fuente.FiltroFrescura.esFresca(vacante.getFechaPublicacion()));
    }

    @Test
    void descartaTarjetasAntiguasOMalFormadas() {
        var docStale = Jsoup.parse("""
                <article class="box_offer" data-id='12345'>
                    <h2><a class="js-o-link" href="/ofertas/vieja-12345">Oferta Vieja</a></h2>
                    <p class="fs16 fc_base"><span class="mr10">Barranquilla, Atlántico</span></p>
                    <p class="fs13 fc_aux">Hace 15 días</p>
                </article>
                <article class="box_offer" data-id='67890'>
                    <h2><a class="js-o-link" href="/ofertas/sin-fecha-67890">Oferta Sin Fecha</a></h2>
                    <p class="fs16 fc_base"><span class="mr10">Barranquilla, Atlántico</span></p>
                </article>
                """);

        var ofertas = ComputrabajoScraper.parsear(docStale, "Barranquilla");
        assertTrue(ofertas.isEmpty(), "las ofertas mayores a 7 días o sin fecha deben ser descartadas");
    }
}
