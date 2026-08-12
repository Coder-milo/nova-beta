package com.novacrm.estudiante;

import com.novacrm.auditoria.AuditoriaService;
import com.novacrm.catalogo.nivel_ingles.NivelInglesRepository;
import com.novacrm.colocacion.ColocacionRepository;
import com.novacrm.documento.StorageService;
import com.novacrm.estudiante.dto.EstudianteRequest;
import com.novacrm.exception.ConflictException;
import com.novacrm.hv.PlantillaHvRepository;
import com.novacrm.programa.Programa;
import com.novacrm.programa.ProgramaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Dar de alta a alguien que ya existe.
 *
 * <p>El correo es unico en la base y el alta no lo comprobaba: la violacion de
 * la restriccion llegaba al manejador generico y salia un 500 «Internal server
 * error». La pantalla, que sabe distinguir 409 de 500, decia que el servidor se
 * habia roto cuando el problema era el dato — y en el log quedaba como
 * "Unhandled exception" con su traza.
 *
 * <p>Ocurre a diario: se abre un proyecto nuevo, la lista sale vacia y se
 * vuelve a matricular a gente que ya esta en otra ruta. Por eso el mensaje dice
 * donde esta esa persona.
 */
class AltaDuplicadaTest {

    private final EstudianteRepository estudiantes = mock(EstudianteRepository.class);
    private final ProgramaRepository programas = mock(ProgramaRepository.class);
    private final EstudianteService service = new EstudianteService(
            estudiantes,
            programas,
            mock(NivelInglesRepository.class),
            mock(AuditoriaService.class),
            mock(ColocacionRepository.class),
            mock(StorageService.class),
            mock(PlantillaHvRepository.class));

    private final UUID programaId = UUID.randomUUID();

    private EstudianteRequest alta(String email, String documento) {
        return new EstudianteRequest(
                "Ana", "Perez", email, null, null, null,
                null, null, documento, null, null, null,
                null, null, null, null, null, null,
                null, null, null, null, null, null,
                null, null, null, null, null, null,
                null, null, null, null, null, null,
                null, null, null, null, null, null,
                // El proyecto al que se matricula: es el componente 43.
                programaId, null, null, null, null, null,
                null, null, null, null, null, null,
                null, null, null);
    }

    private void hayProyecto() {
        var programa = new Programa();
        programa.setNombre("Ruta Bolivar");
        when(programas.findById(programaId)).thenReturn(Optional.of(programa));
    }

    private static Estudiante yaRegistrada(boolean activo, String nombrePrograma) {
        var e = new Estudiante();
        e.setId(UUID.randomUUID());
        e.setNombre("Ana");
        e.setApellido("Perez");
        e.setEmail("ana@cac.test");
        e.setNumeroDocumento("1234567890");
        e.setActivo(activo);
        if (nombrePrograma != null) {
            var p = new Programa();
            p.setNombre(nombrePrograma);
            e.setPrograma(p);
        }
        return e;
    }

    @Test
    @DisplayName("un correo repetido es 409 y no llega a guardarse")
    void unCorreoRepetidoEsConflicto() {
        hayProyecto();
        when(estudiantes.findByEmailIgnoreCase("ana@cac.test"))
                .thenReturn(Optional.of(yaRegistrada(true, "Ruta Accelerator")));

        assertThatThrownBy(() -> service.crear(alta("ana@cac.test", null)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("ana@cac.test")
                // Decir en que proyecto esta es lo que evita el alta repetida:
                // sin eso el mensaje no explica por que "no existe" en la lista.
                .hasMessageContaining("Ruta Accelerator");

        verify(estudiantes, never()).save(any());
    }

    @Test
    @DisplayName("quien esta en la papelera sigue ocupando su correo, y se dice")
    void elDeLaPapeleraSeNombraComoTal() {
        hayProyecto();
        when(estudiantes.findByEmailIgnoreCase("ana@cac.test"))
                .thenReturn(Optional.of(yaRegistrada(false, "Ruta Accelerator")));

        assertThatThrownBy(() -> service.crear(alta("ana@cac.test", null)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("papelera");
    }

    @Test
    @DisplayName("un documento repetido tambien es 409")
    void unDocumentoRepetidoEsConflicto() {
        hayProyecto();
        when(estudiantes.findByEmailIgnoreCase(any())).thenReturn(Optional.empty());
        when(estudiantes.findByDocumentoNormalizado("1234567890"))
                .thenReturn(Optional.of(yaRegistrada(true, "Ruta Accelerator")));

        assertThatThrownBy(() -> service.crear(alta("otra@cac.test", "1234567890")))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("1234567890");

        verify(estudiantes, never()).save(any());
    }

    @Test
    @DisplayName("sin duplicado el alta sigue funcionando")
    void sinDuplicadoSeCrea() {
        hayProyecto();
        when(estudiantes.findByEmailIgnoreCase(any())).thenReturn(Optional.empty());
        when(estudiantes.findByDocumentoNormalizado(any())).thenReturn(Optional.empty());
        when(estudiantes.save(any())).thenAnswer(invocacion -> {
            Estudiante guardado = invocacion.getArgument(0);
            guardado.setId(UUID.randomUUID());
            return guardado;
        });

        var creado = service.crear(alta("nueva@cac.test", "9999999999"));

        assertThat(creado.email()).isEqualTo("nueva@cac.test");
        verify(estudiantes).save(any());
    }
}
