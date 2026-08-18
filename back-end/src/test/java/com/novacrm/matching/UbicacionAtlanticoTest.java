package com.novacrm.matching;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class UbicacionAtlanticoTest {

    private MatchingService matchingService;

    @BeforeEach
    void setUp() {
        matchingService = mock(MatchingService.class,
                org.mockito.Mockito.withSettings().defaultAnswer(
                        org.mockito.Mockito.CALLS_REAL_METHODS));
    }

    @Test
    void coincidenciaMetropolitanaOtorgaPuntajeMaximo() throws Exception {
        Estudiante e = new Estudiante();
        e.setCiudad("Soledad");

        Vacante v = new Vacante();
        v.setCiudad("Barranquilla");
        v.setUbicacion("Barranquilla, Atlántico");

        var method = MatchingService.class.getDeclaredMethod("ratioUbicacion", Estudiante.class, Vacante.class);
        method.setAccessible(true);
        Double score = (Double) method.invoke(matchingService, e, v);

        assertNotNull(score);
        assertEquals(1.0, score, 0.001, "La coincidencia entre Soledad y Barranquilla (Área Metropolitana del Atlántico) debe puntuar 1.0");
    }

    @Test
    void vacanteRemotaOtorgaPuntajeMaximo() throws Exception {
        Estudiante e = new Estudiante();
        e.setCiudad("Barranquilla");

        Vacante v = new Vacante();
        v.setCiudad("Cualquier lugar");
        v.setModalidadTrabajo("Trabajo Remoto");

        var method = MatchingService.class.getDeclaredMethod("ratioUbicacion", Estudiante.class, Vacante.class);
        method.setAccessible(true);
        Double score = (Double) method.invoke(matchingService, e, v);

        assertNotNull(score);
        assertEquals(1.0, score, 0.001);
    }
}
