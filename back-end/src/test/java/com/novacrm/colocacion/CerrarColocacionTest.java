package com.novacrm.colocacion;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.seguimiento.EstadoContacto;
import com.novacrm.seguimiento.Seguimiento;
import com.novacrm.seguimiento.SeguimientoRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Que pasa con la tarjeta del tablero cuando alguien deja de trabajar.
 *
 * <p>Registrar una colocacion movia la tarjeta a COLOCADO y cerrarla no la
 * devolvia. El tablero es lo que mira el equipo para decidir a quien acompañar,
 * asi que la persona que mas lo necesitaba —acaba de quedarse sin empleo— era
 * justo la que parecia resuelta.
 */
class CerrarColocacionTest {

    private final ColocacionRepository colocaciones = mock(ColocacionRepository.class);
    private final SeguimientoRepository seguimientos = mock(SeguimientoRepository.class);

    private ColocacionService servicio() {
        return new ColocacionService(
                colocaciones,
                mock(com.novacrm.estudiante.EstudianteRepository.class),
                mock(com.novacrm.postulacion.PostulacionRepository.class),
                mock(com.novacrm.empresa.EmpresaRepository.class),
                seguimientos,
                mock(com.novacrm.auditoria.AuditoriaService.class),
                new java.math.BigDecimal("2276176"));
    }

    private Colocacion colocacionDe(Estudiante estudiante) {
        var c = new Colocacion();
        c.setId(UUID.randomUUID());
        c.setEstudiante(estudiante);
        c.setTipoVinculacion(TipoVinculacion.EMPLEADO);
        c.setActiva(true);
        return c;
    }

    private Estudiante estudiante() {
        var e = new Estudiante();
        e.setId(UUID.randomUUID());
        e.setNombre("Ana");
        e.setApellido("Perez");
        return e;
    }

    @Test
    void cerrarLaUnicaColocacionDevuelveLaTarjetaAEnProceso() {
        var ana = estudiante();
        var colocacion = colocacionDe(ana);
        when(colocaciones.findById(colocacion.getId())).thenReturn(Optional.of(colocacion));
        when(colocaciones.existsByEstudianteIdAndActivaTrue(ana.getId())).thenReturn(false);

        servicio().cerrar(colocacion.getId(), "Fin de contrato", "coordinadora@cac.test");

        var guardados = ArgumentCaptor.forClass(Seguimiento.class);
        verify(seguimientos, atLeastOnce()).save(guardados.capture());
        assertTrue(guardados.getAllValues().stream()
                        .anyMatch(s -> EstadoContacto.EN_PROCESO.name().equals(s.getEstado())),
                "sin empleo, la tarjeta vuelve al proceso: es a quien hay que acompañar");
    }

    /**
     * Alguien puede tener dos vinculaciones y dejar una. Eso no le deja sin
     * trabajo, asi que la tarjeta se queda donde esta.
     */
    @Test
    void siLeQuedaOtraVigenteLaTarjetaNoSeMueve() {
        var ana = estudiante();
        var colocacion = colocacionDe(ana);
        when(colocaciones.findById(colocacion.getId())).thenReturn(Optional.of(colocacion));
        when(colocaciones.existsByEstudianteIdAndActivaTrue(ana.getId())).thenReturn(true);

        servicio().cerrar(colocacion.getId(), "Deja una de las dos", "coordinadora@cac.test");

        var guardados = ArgumentCaptor.forClass(Seguimiento.class);
        verify(seguimientos, atLeast(0)).save(guardados.capture());
        assertTrue(guardados.getAllValues().stream()
                        .noneMatch(s -> EstadoContacto.EN_PROCESO.name().equals(s.getEstado())),
                "sigue colocada por la otra vinculacion");
    }

    /** Lo que no es empleo no mueve el tablero, ni al entrar ni al salir. */
    @Test
    void loQueNoEsEmpleoNoMueveLaTarjeta() {
        var ana = estudiante();
        var colocacion = colocacionDe(ana);
        colocacion.setTipoVinculacion(TipoVinculacion.FORMACION);
        when(colocaciones.findById(colocacion.getId())).thenReturn(Optional.of(colocacion));

        servicio().cerrar(colocacion.getId(), "Termino la practica", "coordinadora@cac.test");

        verify(colocaciones, never()).existsByEstudianteIdAndActivaTrue(any());
    }
}
