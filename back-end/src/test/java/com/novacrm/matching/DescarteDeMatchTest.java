package com.novacrm.matching;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstadoAcademico;
import com.novacrm.estudiante.EstadoEmpleabilidad;
import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Que pasa cuando alguien dice que no.
 *
 * <p>Descartar borraba la fila, y con ella la unica etiqueta negativa que
 * produce el sistema: el boton "No, gracias" de la plantilla de WhatsApp, donde
 * la persona vio la vacante y la rechazo. Sin negativos no se puede medir si un
 * puntaje alto predice una respuesta positiva.
 */
class DescarteDeMatchTest {

    private MatchRepository matchRepository;
    private MatchingService matchingService;

    @BeforeEach
    void configurar() {
        matchRepository = mock(MatchRepository.class);
        matchingService = new MatchingService(
                matchRepository, null, null, null, null, null, null, null, null);
    }

    private Match match() {
        var m = new Match();
        m.setEstudiante(new Estudiante());
        m.setVacante(new Vacante());
        when(matchRepository.findById(m.getId())).thenReturn(Optional.of(m));
        return m;
    }

    @Test
    void descartarConservaLaFilaYAnotaQuienFue() {
        var m = match();

        matchingService.descartarMatch(m.getId(), "WhatsApp");

        assertTrue(m.isDescartado());
        assertEquals("WhatsApp", m.getDescartadoPor());
        assertNotNull(m.getDescartadoEn());
        verify(matchRepository).save(m);
        verify(matchRepository, never()).delete(any());
        verify(matchRepository, never()).deleteById(any());
    }

    /** Dos toques al mismo boton no deben mover la fecha del rechazo original. */
    @Test
    void descartarDosVecesNoCambiaNada() {
        var m = match();
        matchingService.descartarMatch(m.getId(), "WhatsApp");
        var primeraVez = m.getDescartadoEn();
        reset(matchRepository);
        when(matchRepository.findById(m.getId())).thenReturn(Optional.of(m));

        matchingService.descartarMatch(m.getId(), "coordinador@cac.edu.co");

        assertEquals(primeraVez, m.getDescartadoEn());
        assertEquals("WhatsApp", m.getDescartadoPor());
        verify(matchRepository, never()).save(any());
    }

    @Test
    void descartarUnMatchQueNoExisteEsUnError() {
        var id = UUID.randomUUID();
        when(matchRepository.findById(id)).thenReturn(Optional.empty());

        assertThrows(com.novacrm.exception.ResourceNotFoundException.class,
                () -> matchingService.descartarMatch(id, "coordinador@cac.edu.co"));
    }

    /**
     * `activo` solo dice que la ficha no esta en la papelera. Recomendarle
     * vacantes a quien se retiro o a quien ya esta colocado es ruido para esa
     * persona y trabajo perdido para el equipo.
     */
    @Test
    void noSeLeBuscaEmpleoAQuienNoLoEstaBuscando() {
        var retirado = new Estudiante();
        retirado.setEstadoAcademico(EstadoAcademico.RETIRADO);
        var empleado = new Estudiante();
        empleado.setEstadoEmpleabilidad(EstadoEmpleabilidad.EMPLEADO);
        var buscando = new Estudiante();
        buscando.setEstadoAcademico(EstadoAcademico.ACTIVO);
        buscando.setEstadoEmpleabilidad(EstadoEmpleabilidad.BUSCANDO);

        assertFalse(MatchingService.buscaEmpleo(retirado));
        assertFalse(MatchingService.buscaEmpleo(empleado));
        assertTrue(MatchingService.buscaEmpleo(buscando));
    }

    /** Sin informacion de empleabilidad se sigue buscando: es el estado por defecto. */
    @Test
    void sinInformacionDeEmpleabilidadSeSigueBuscando() {
        var e = new Estudiante();

        assertEquals(EstadoEmpleabilidad.SIN_INFO, e.getEstadoEmpleabilidad());
        assertTrue(MatchingService.buscaEmpleo(e));
    }
}
