package com.novacrm.seguimiento;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * El historial de seguimiento del propio estudiante, cuando su correo lleva
 * mayusculas.
 *
 * <p>Los correos se cargaron desde Excel tal y como venian escritos, y algunos
 * participantes los tienen con mayuscula. Con igualdad exacta, esas personas
 * abrian su historial y les decia que su ficha no existe —un dato que si
 * existe—. Es la misma leccion que ya esta escrita en {@code OwnershipService}
 * y en la importacion, y que a este servicio no habia llegado.
 */
class HistorialConMayusculasTest {

    private final SeguimientoRepository seguimientos = mock(SeguimientoRepository.class);
    private final EstudianteRepository estudiantes = mock(EstudianteRepository.class);
    private final SeguimientoService servicio = new SeguimientoService(seguimientos, estudiantes);

    @Test
    void unCorreoConMayusculasEncuentraSuHistorial() {
        var ana = new Estudiante();
        ana.setId(UUID.randomUUID());
        ana.setEmail("Ana.Perez@cac.test");

        // La base guarda el correo con mayusculas; el token trae lo que el
        // usuario escribio. Solo la consulta que ignora la caja los cruza.
        when(estudiantes.findByEmailIgnoreCase("ana.perez@cac.test")).thenReturn(Optional.of(ana));
        when(seguimientos.findByEstudianteIdOrderByFechaDesc(ana.getId())).thenReturn(List.of());

        assertThat(servicio.listarPorEmail("ana.perez@cac.test")).isEmpty();
        verify(seguimientos).findByEstudianteIdOrderByFechaDesc(ana.getId());
        verify(estudiantes, never()).findById(any());
    }
}
