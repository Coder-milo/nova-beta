package com.novacrm.seguimiento;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Lo que el estudiante recibe de su propio historial de acompanamiento.
 *
 * <p>El campo {@code responsable} se rellena con {@code auth.getName()} en los
 * caminos automaticos —registrar una colocacion, mover una tarjeta, cambiar el
 * estado de una postulacion— y el sujeto del token es el correo. Asi que el
 * historial viajaba al navegador del estudiante con la direccion interna de
 * quien hizo cada anotacion.
 *
 * <p>Ninguna pantalla del portal lo pinta, o sea que no se pierde nada al
 * quitarlo. Iba en el JSON y ahi seguiria hasta el dia en que alguien anadiera
 * una columna «quien» y lo publicara sin querer.
 */
class HistorialSinCorreosInternosTest {

    private final SeguimientoRepository seguimientos = mock(SeguimientoRepository.class);
    private final EstudianteRepository estudiantes = mock(EstudianteRepository.class);
    private final SeguimientoService servicio = new SeguimientoService(seguimientos, estudiantes);

    private Seguimiento apunte() {
        var s = new Seguimiento();
        s.setTipo("CONTACTO");
        s.setEstado("EN_PROCESO");
        s.setFecha(LocalDate.of(2026, 7, 1));
        s.setResponsable("coordinadora@cac.test");
        s.setObservacion("Se le llamo para la feria.");
        return s;
    }

    @Test
    @DisplayName("el historial propio no lleva el correo de quien lo anoto")
    void noViajaElCorreoDelEquipo() {
        var ana = new Estudiante();
        ana.setId(UUID.randomUUID());
        ana.setEmail("ana@cac.test");
        when(estudiantes.findByEmailIgnoreCase("ana@cac.test")).thenReturn(Optional.of(ana));
        when(seguimientos.findByEstudianteIdOrderByFechaDesc(ana.getId()))
                .thenReturn(List.of(apunte()));

        var historial = servicio.listarPorEmail("ana@cac.test");

        assertThat(historial).hasSize(1);
        var campos = Arrays.stream(historial.get(0).getClass().getRecordComponents())
                .map(java.lang.reflect.RecordComponent::getName)
                .toList();
        assertThat(campos)
                .as("el correo interno de quien anota no es asunto del estudiante")
                .doesNotContain("responsable");
    }

    /** Lo que la pantalla si usa sigue llegando. */
    @Test
    @DisplayName("y sigue trayendo lo que el portal enseña")
    void conservaLoQueLaPantallaPinta() {
        var ana = new Estudiante();
        ana.setId(UUID.randomUUID());
        ana.setEmail("ana@cac.test");
        when(estudiantes.findByEmailIgnoreCase("ana@cac.test")).thenReturn(Optional.of(ana));
        when(seguimientos.findByEstudianteIdOrderByFechaDesc(ana.getId()))
                .thenReturn(List.of(apunte()));

        var fila = servicio.listarPorEmail("ana@cac.test").get(0);

        assertThat(fila.tipo()).isEqualTo("CONTACTO");
        assertThat(fila.estado()).isEqualTo("EN_PROCESO");
        assertThat(fila.fecha()).isEqualTo(LocalDate.of(2026, 7, 1));
        assertThat(fila.observacion()).isEqualTo("Se le llamo para la feria.");
    }
}
