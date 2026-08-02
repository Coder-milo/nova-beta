package com.novacrm.scraper;

import com.novacrm.scraper.fuente.FuenteDeVacantes;
import com.novacrm.scraper.fuente.ResultadoBusqueda;
import com.novacrm.scraper.fuente.Segmento;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/**
 * Cuantas peticiones dispara una corrida.
 *
 * <p>El bucle anterior recorria termino×ciudad para todas las fuentes por
 * igual, aunque ninguna implementacion usara la ciudad: cinco peticiones
 * identicas por termino, hasta cuarenta por corrida, contra APIs que piden como
 * mucho cuatro al dia o que cobran por llamada.
 */
class ConsultasPorFuenteTest {

    private final ScrapingService servicio = new ScrapingService(
            List.of(), null, null, null, null);

    private final ScrapingService.Criterios criterios = new ScrapingService.Criterios(
            List.of("call center", "servicio al cliente", "auxiliar administrativo"),
            List.of("Barranquilla", "Soledad", "Cartagena", "Santa Marta", "Bogota"));

    /** Fuente de prueba con el comportamiento declarado que se quiera. */
    private FuenteDeVacantes fuente(boolean filtraPorCiudad, int tope) {
        return new FuenteDeVacantes() {
            @Override public String nombre() { return "PRUEBA"; }
            @Override public Segmento segmento() { return Segmento.LOCAL_COLOMBIA; }
            @Override public boolean filtraPorCiudad() { return filtraPorCiudad; }
            @Override public int maximoConsultasPorCorrida() { return tope; }
            @Override public ResultadoBusqueda buscar(String t, String c) {
                return ResultadoBusqueda.vacio();
            }
        };
    }

    @Test
    void unaFuenteQueNoFiltraPorCiudadSeConsultaUnaVezPorTermino() {
        var consultas = servicio.consultasPara(fuente(false, Integer.MAX_VALUE), criterios);

        assertEquals(3, consultas.size(),
                "tres terminos, no tres por cinco ciudades con resultado identico");
        assertTrue(consultas.stream().allMatch(c -> c.ciudad() == null),
                "no tiene sentido pasarle una ciudad que va a ignorar");
    }

    @Test
    void unaFuenteQueSiFiltraRecorreLasCiudades() {
        var consultas = servicio.consultasPara(fuente(true, Integer.MAX_VALUE), criterios);

        assertEquals(15, consultas.size(), "tres terminos por cinco ciudades");
    }

    /** JSearch da 200 peticiones al mes: 15 por corrida diaria son 450. */
    @Test
    void elTopeDeLaFuenteRecortaLasConsultas() {
        var consultas = servicio.consultasPara(fuente(true, 6), criterios);

        assertEquals(6, consultas.size());
    }

    @Test
    void losTerminosRepetidosNoGastanPeticionesDeMas() {
        var conRepetidos = new ScrapingService.Criterios(
                List.of("call center", "call center", "bpo"), List.of("Barranquilla"));

        var consultas = servicio.consultasPara(fuente(true, Integer.MAX_VALUE), conRepetidos);

        assertEquals(2, consultas.size());
    }

    @Test
    void sinTerminosNoSeConsultaNada() {
        var vacio = new ScrapingService.Criterios(List.of(), List.of("Barranquilla"));

        assertTrue(servicio.consultasPara(fuente(true, Integer.MAX_VALUE), vacio).isEmpty());
    }
}
