package com.novacrm.seguimiento;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.matching.MatchRepository;
import com.novacrm.pipeline.PipelineEmpleabilidad;
import com.novacrm.pipeline.PipelineEmpleabilidadService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * El tablero ensena solo el proyecto que se pide.
 *
 * <p>El selector de arriba cambiaba de proyecto y seguian saliendo los mismos
 * estudiantes: al abrir la ruta vacia aparecia la cohorte entera de la otra, y
 * el equipo daba de alta otra vez a gente que ya estaba registrada porque la
 * lista parecia decir que estaban ahi.
 *
 * <p>Se fija lo que se consulta y no solo lo que sale: el filtro tiene que
 * llegar a la base. Traer las 108 fichas para descartarlas en memoria daria el
 * mismo resultado en esta prueba y seria otro problema.
 */
class TableroPorProyectoTest {

    private final EstudianteRepository estudiantes = mock(EstudianteRepository.class);
    private final SeguimientoRepository seguimientos = mock(SeguimientoRepository.class);
    private final MatchRepository matches = mock(MatchRepository.class);
    private final PipelineEmpleabilidadService pipeline = mock(PipelineEmpleabilidadService.class);
    private final TableroService service =
            new TableroService(estudiantes, seguimientos, matches, pipeline);

    private static Estudiante ficha(String nombre) {
        var e = new Estudiante();
        e.setId(UUID.randomUUID());
        e.setNombre(nombre);
        e.setApellido("De Prueba");
        e.setActivo(true);
        return e;
    }

    @Test
    void conProyectoSoloSalenLosDeEseProyecto() {
        var bolivar = UUID.randomUUID();
        when(estudiantes.findAllByProgramaIdAndActivoTrue(bolivar)).thenReturn(List.of(ficha("Solo")));
        when(seguimientos.historialDeVarios(any())).thenReturn(List.of());
        when(matches.contarPostuladosDeVarios(any())).thenReturn(List.of());
        when(pipeline.calcular(any(Estudiante.class))).thenReturn(mock(PipelineEmpleabilidad.class));

        var tablero = service.construir(bolivar);

        assertEquals(1, tablero.totalEstudiantes());
        verify(estudiantes).findAllByProgramaIdAndActivoTrue(bolivar);
        // La consulta sin filtrar no se toca: era la que devolvia la cohorte
        // entera cuando se pedia otro proyecto.
        verify(estudiantes, never()).findAllByActivoTrue();
    }

    @Test
    void unProyectoSinEstudiantesDevuelveElTableroVacio() {
        var bolivar = UUID.randomUUID();
        when(estudiantes.findAllByProgramaIdAndActivoTrue(bolivar)).thenReturn(List.of());

        var tablero = service.construir(bolivar);

        assertEquals(0, tablero.totalEstudiantes());
        assertTrue(tablero.columnas().stream().allMatch(c -> c.tarjetas().isEmpty()),
                "un proyecto sin gente no puede pintar tarjetas de otro");
        // Sin fichas no hay a quien pedirle historial ni postulaciones: pedirlo
        // con la lista vacia es un viaje a la base que no responde nada.
        verify(seguimientos, never()).historialDeVarios(any());
        verify(matches, never()).contarPostuladosDeVarios(any());
    }

    @Test
    void sinProyectoSiguenSaliendoTodos() {
        when(estudiantes.findAllByActivoTrue()).thenReturn(List.of(ficha("Una"), ficha("Otra")));
        when(seguimientos.historialDeVarios(any())).thenReturn(List.of());
        when(matches.contarPostuladosDeVarios(any())).thenReturn(List.of());
        when(pipeline.calcular(any(Estudiante.class))).thenReturn(mock(PipelineEmpleabilidad.class));

        var tablero = service.construir(null);

        assertEquals(2, tablero.totalEstudiantes());
        verify(estudiantes).findAllByActivoTrue();
    }
}
