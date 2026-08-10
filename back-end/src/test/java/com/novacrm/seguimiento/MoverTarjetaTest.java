package com.novacrm.seguimiento;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.matching.MatchRepository;
import com.novacrm.pipeline.PipelineEmpleabilidad;
import com.novacrm.pipeline.PipelineEmpleabilidadService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Mover una tarjeta del tablero escribe un movimiento nuevo; no edita el
 * anterior. Ese historial es lo que lee el equipo para saber que ha pasado con
 * una persona, asi que lo que se apunta en el importa tanto como donde queda la
 * tarjeta.
 */
class MoverTarjetaTest {

    private SeguimientoRepository seguimientos;
    private EstudianteRepository estudiantes;
    private TableroService service;
    private Estudiante ana;

    @BeforeEach
    void preparar() {
        seguimientos = mock(SeguimientoRepository.class);
        estudiantes = mock(EstudianteRepository.class);
        var pipeline = mock(PipelineEmpleabilidadService.class);
        var matches = mock(MatchRepository.class);
        service = new TableroService(estudiantes, seguimientos, matches, pipeline);

        ana = new Estudiante();
        ana.setId(UUID.randomUUID());
        ana.setNombre("Ana");
        ana.setApellido("Perez");
        ana.setActivo(true);
        when(estudiantes.findById(ana.getId())).thenReturn(Optional.of(ana));

        when(pipeline.calcular(any())).thenReturn(mock(PipelineEmpleabilidad.class));
    }

    private Seguimiento movimiento(EstadoContacto estado) {
        var s = new Seguimiento();
        s.setEstudiante(ana);
        s.setTipo(EstadoContacto.TIPO);
        s.setEstado(estado.name());
        s.setFecha(LocalDate.now());
        return s;
    }

    @Test
    void moverAOtraColumnaApuntaElMovimiento() {
        when(seguimientos.findByEstudianteIdOrderByFechaDesc(ana.getId()))
                .thenReturn(List.of(movimiento(EstadoContacto.EN_PROCESO)));

        service.mover(ana.getId(), EstadoContacto.ENTREVISTA, "coordinadora@cac.test", null);

        verify(seguimientos).save(any(Seguimiento.class));
    }

    /**
     * Soltar la tarjeta donde ya estaba no es un movimiento. Sin esto, cada vez
     * que alguien la suelta donde la cogio se apunta una linea que no cuenta
     * nada, y ese historial es lo que el equipo lee para entender el caso.
     */
    @Test
    void soltarlaDondeYaEstabaNoApuntaNada() {
        when(seguimientos.findByEstudianteIdOrderByFechaDesc(ana.getId()))
                .thenReturn(List.of(movimiento(EstadoContacto.ENTREVISTA)));

        service.mover(ana.getId(), EstadoContacto.ENTREVISTA, "coordinadora@cac.test", null);

        verify(seguimientos, never()).save(any(Seguimiento.class));
    }

    /**
     * Salvo que traiga nota: entonces lo que se registra es la nota, y
     * descartarla por no haber cambio de columna seria tirar lo unico que
     * traia informacion.
     */
    @Test
    void conNotaSiSeApuntaAunqueLaColumnaNoCambie() {
        when(seguimientos.findByEstudianteIdOrderByFechaDesc(ana.getId()))
                .thenReturn(List.of(movimiento(EstadoContacto.ENTREVISTA)));

        service.mover(ana.getId(), EstadoContacto.ENTREVISTA, "coordinadora@cac.test",
                "Llamada del martes: sigue interesada");

        verify(seguimientos).save(any(Seguimiento.class));
    }

    /** Sin historial, la tarjeta ya esta en SIN_CONTACTO: moverla ahi no es mover. */
    @Test
    void sinHistorialMoverAInicialNoApuntaNada() {
        when(seguimientos.findByEstudianteIdOrderByFechaDesc(ana.getId())).thenReturn(List.of());

        service.mover(ana.getId(), EstadoContacto.SIN_CONTACTO, "coordinadora@cac.test", null);

        verify(seguimientos, never()).save(any(Seguimiento.class));
    }

    @Test
    void sinEstadoDestinoNoSeMueve() {
        assertThrows(BusinessException.class,
                () -> service.mover(ana.getId(), null, "coordinadora@cac.test", null));
        verify(seguimientos, never()).save(any(Seguimiento.class));
    }
}
