package com.novacrm.matching;

import com.novacrm.catalogo.nivel_ingles.NivelIngles;
import com.novacrm.config.MatchingConfig;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Una vacante de la que no se sabe nada no debe emparejar con nadie.
 *
 * <p>Es la prueba que guarda todo el diagnostico del motor. Antes, un dato que
 * faltaba puntuaba como dato bueno: la vacante sin nivel de ingles se llevaba
 * sus 20 puntos, la que no declaraba experiencia otros 20, la ubicacion
 * desconocida medio peso, y un perfil sin solape la mitad de la afinidad. El
 * piso de una vacante vacia quedaba en 69 sobre un umbral de 55, asi que toda
 * vacante emparejaba con todo participante y el puntaje no informaba nada.
 *
 * <p>Ahora los criterios sin datos quedan fuera del reparto y ademas se exige
 * una cobertura minima, de modo que un puntaje alto sostenido por un solo
 * criterio tampoco pasa.
 */
class VacanteSinDatosTest {

    private MatchingConfig config;
    private MatchingService matchingService;
    private PesosPorRareza pesos;

    @BeforeEach
    void configurar() {
        // Config real, cargada del yml que se despliega: si alguien cambia los
        // pesos o el umbral, esta prueba se entera.
        config = new MatchingConfig();
        config.init();
        matchingService = new MatchingService(null, null, null, null, config, null, null, null);
        // Pool de vacantes de referencia con el que se estima que informa cada
        // token. Mezcla oficios para que ninguno sea trivialmente raro.
        pesos = PesosPorRareza.de(List.of(
                Set.of("servicio_cliente", "call_center", "ingles_nivel"),
                Set.of("servicio_cliente", "trabajo_de_voz"),
                Set.of("logistica", "bodega"),
                Set.of("desarrollador", "java")));
    }

    private Estudiante participanteTipico() {
        var e = new Estudiante();
        e.setCiudad("Barranquilla");
        var nivel = new NivelIngles();
        nivel.setCodigo("B1");
        e.setNivelIngles(nivel);
        e.setResultadoPruebaEscrita("B1");
        e.setResultadoPruebaOral("B1");
        e.setAniosExperiencia(2);
        return e;
    }

    /** El caso que rompia el motor: anuncio sin ningun campo aprovechable. */
    @Test
    void unaVacanteSinDatosNoGeneraMatch() {
        var vacante = new Vacante();
        vacante.setTitulo("Oportunidad laboral");

        var desglose = matchingService.calcularPuntaje(
                participanteTipico(), vacante,
                Set.of("servicio_cliente", "bpo"), Set.of(),
                Set.of("servicio_cliente"), Set.of(), pesos);

        assertNull(desglose.ingles(), "la vacante no declara nivel de ingles");
        assertNull(desglose.experiencia(), "la vacante no declara anios de experiencia");
        assertNull(desglose.ubicacion(), "la vacante no dice donde es");
        assertNull(desglose.afinidad(), "no hay texto de la vacante con que comparar");
        assertNull(desglose.habilidades());

        assertEquals(0.0, desglose.cobertura().doubleValue(), 0.0001,
                "ningun criterio tenia datos");
        assertFalse(matchingService.superaElCorte(desglose, config.getUmbralMinimo()),
                "una vacante de la que no se sabe nada no puede ser una recomendacion");
    }

    /**
     * Un puntaje perfecto sostenido por un unico criterio tampoco basta: es
     * justo el agujero que dejaria renormalizar sin exigir cobertura.
     */
    @Test
    void unPuntajePerfectoSobreUnSoloCriterioNoAlcanzaLaCoberturaMinima() {
        var vacante = new Vacante();
        vacante.setTitulo("Oportunidad laboral");
        vacante.setModalidadTrabajo("Remoto");

        var desglose = matchingService.calcularPuntaje(
                participanteTipico(), vacante,
                Set.of("servicio_cliente"), Set.of(),
                Set.of("servicio_cliente"), Set.of(), pesos);

        assertEquals(1.0, desglose.ubicacion(), 0.0001, "remota vale para cualquier ciudad");
        assertEquals(100.0, desglose.puntaje().doubleValue(), 0.0001,
                "el unico criterio evaluado se cumple entero");
        assertTrue(desglose.cobertura().doubleValue() < config.getCoberturaMinima(),
                "un solo criterio no es evidencia suficiente");
        assertFalse(matchingService.superaElCorte(desglose, config.getUmbralMinimo()));
    }

    /**
     * La contraparte: con la vacante enriquecida el motor si decide, y decide
     * con los cinco criterios. Sin esta prueba, la de arriba se podria aprobar
     * dejando el motor sin emparejar nada.
     */
    @Test
    void unaVacanteEnriquecidaSiSeEvaluaYPuedeSerMatch() {
        var vacante = new Vacante();
        vacante.setTitulo("Agente bilingue de servicio al cliente");
        vacante.setNivelInglesRequerido("B1");
        vacante.setAniosExperienciaRequeridos(1);
        vacante.setCiudad("Barranquilla");
        vacante.setModalidadTrabajo("Presencial");

        var desglose = matchingService.calcularPuntaje(
                participanteTipico(), vacante,
                Set.of("servicio_cliente", "bpo"), Set.of("servicio_cliente"),
                Set.of("servicio_cliente"), Set.of("servicio_cliente"), pesos);

        assertEquals(1.0, desglose.cobertura().doubleValue(), 0.0001,
                "los cinco criterios tenian datos");
        assertEquals(1.0, desglose.ingles(), 0.0001);
        assertEquals(1.0, desglose.experiencia(), 0.0001);
        assertEquals(1.0, desglose.ubicacion(), 0.0001);
        assertTrue(matchingService.superaElCorte(desglose, config.getUmbralMinimo()),
                () -> "deberia emparejar, fue " + desglose.puntaje());
    }

    /**
     * Con datos completos el puntaje se separa segun lo que cumple, en vez de
     * amontonarse justo encima del umbral como hacia con los rellenos.
     */
    @Test
    void elPuntajeDistingueAQuienCumpleDeQuienNo() {
        var vacante = new Vacante();
        vacante.setTitulo("Agente bilingue de servicio al cliente");
        vacante.setNivelInglesRequerido("B2");
        vacante.setAniosExperienciaRequeridos(4);
        vacante.setCiudad("Bogota");
        vacante.setModalidadTrabajo("Presencial");

        // Apunta a bodega, no a BPO: no comparte ni el perfil ni el nivel ni la
        // ciudad, y no puede desplazarse.
        var lejano = new Estudiante();
        lejano.setCiudad("Barranquilla");
        lejano.setResultadoPruebaOral("A1");
        lejano.setAniosExperiencia(1);
        lejano.setDisponibilidadMovilidad(false);

        var desgloseLejano = matchingService.calcularPuntaje(
                lejano, vacante,
                Set.of("logistica", "bodega"), Set.of("servicio_cliente"),
                Set.of("logistica"), Set.of("servicio_cliente"), pesos);
        var desgloseIdoneo = matchingService.calcularPuntaje(
                participanteTipico(), vacante,
                Set.of("servicio_cliente"), Set.of("servicio_cliente"),
                Set.of("servicio_cliente"), Set.of("servicio_cliente"), pesos);

        assertTrue(desgloseIdoneo.puntaje().compareTo(desgloseLejano.puntaje()) > 0,
                "el que esta mas cerca del perfil debe puntuar mas alto");
        assertFalse(matchingService.superaElCorte(desgloseLejano, config.getUmbralMinimo()),
                () -> "un A1 oral sin experiencia y en otra ciudad no deberia pasar, fue "
                        + desgloseLejano.puntaje());
    }
}
