package com.novacrm.seguimiento;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.matching.MatchRepository;
import com.novacrm.pipeline.PipelineEmpleabilidad;
import com.novacrm.pipeline.PipelineEmpleabilidadService;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Cuantas veces se va el tablero a la base de datos.
 *
 * <p>El tablero se rehace entero cada vez que se abre y despues de cada
 * movimiento de tarjeta, con una ficha por estudiante. Con 108 personas, lo que
 * en una parece gratis se multiplica por 108 varias veces al dia.
 *
 * <p>Esta prueba no fija el numero total —el N+1 del historial sigue ahi y esta
 * documentado— sino una cosa concreta: que no se vuelva a buscar por
 * identificador una ficha que ya esta leida.
 */
class ConsultasDelTableroTest {

    @Test
    void noSeVuelveABuscarUnaFichaQueYaEstaLeida() {
        var estudiantes = mock(EstudianteRepository.class);
        var seguimientos = mock(SeguimientoRepository.class);
        var matches = mock(MatchRepository.class);
        var pipeline = mock(PipelineEmpleabilidadService.class);

        var cohorte = new ArrayList<Estudiante>();
        for (int i = 0; i < 108; i++) {
            var e = new Estudiante();
            e.setId(UUID.randomUUID());
            e.setNombre("Persona " + i);
            e.setApellido("De Prueba");
            e.setActivo(true);
            cohorte.add(e);
        }
        when(estudiantes.findAllByActivoTrue()).thenReturn(cohorte);
        when(seguimientos.findByEstudianteIdOrderByFechaDesc(any())).thenReturn(List.of());
        var pipelines = cohorte.stream().collect(Collectors.toMap(
                Estudiante::getId,
                ignored -> mock(PipelineEmpleabilidad.class)));
        when(pipeline.calcularVarios(anyList(), anyMap(), anyMap())).thenReturn(pipelines);

        var service = new TableroService(estudiantes, seguimientos, matches, pipeline);
        service.construir();

        // La cohorte se lee una vez, en bloque.
        verify(estudiantes).findAllByActivoTrue();
        // Y ni una sola busqueda por identificador: eran 108, una por tarjeta,
        // para traer lo que la linea anterior ya habia traido.
        verify(estudiantes, never()).findById(any());
        verify(pipeline, never()).calcular(any(UUID.class));
        verify(pipeline, never()).calcular(any(Estudiante.class));
        verify(pipeline).calcularVarios(anyList(), anyMap(), anyMap());
    }
}
