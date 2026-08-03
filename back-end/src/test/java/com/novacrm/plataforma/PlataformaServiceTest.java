package com.novacrm.plataforma;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.plataforma.dto.PlataformaAsignacionRequest;
import com.novacrm.programa.Programa;
import com.novacrm.programa.ProgramaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PlataformaServiceTest {

    @Mock
    private PlataformaRepository plataformaRepository;
    @Mock
    private ProgramaPlataformaRepository programaPlataformaRepository;
    @Mock
    private EstudiantePlataformaRepository estudiantePlataformaRepository;
    @Mock
    private ProgramaRepository programaRepository;
    @Mock
    private EstudianteRepository estudianteRepository;

    @InjectMocks
    private PlataformaService servicio;

    private UUID programaId;
    private UUID estudianteId;
    private UUID plat1Id;
    private UUID plat2Id;

    @BeforeEach
    void setUp() {
        programaId = UUID.randomUUID();
        estudianteId = UUID.randomUUID();
        plat1Id = UUID.randomUUID();
        plat2Id = UUID.randomUUID();
    }

    @Test
    @DisplayName("El portal del estudiante solo muestra plataformas activas")
    void plataformasDeEstudiantePorEmail_soloMuestraActivas() {
        String email = "estudiante@ejemplo.com";
        var programa = new Programa();
        programa.setId(programaId);

        var estudiante = new Estudiante();
        estudiante.setId(estudianteId);
        estudiante.setEmail(email);
        estudiante.setPrograma(programa);

        when(estudianteRepository.findByEmail(email)).thenReturn(Optional.of(estudiante));
        when(programaPlataformaRepository.findPlataformaIdsByProgramaId(programaId))
                .thenReturn(List.of(plat1Id, plat2Id));

        var p1 = new Plataforma();
        p1.setId(plat1Id);
        p1.setNombre("Moodle");
        p1.setActivo(true);

        var p2 = new Plataforma();
        p2.setId(plat2Id);
        p2.setNombre("Slack Desactivado");
        p2.setActivo(false);

        when(plataformaRepository.findAllById(anySet())).thenReturn(List.of(p1, p2));

        var result = servicio.plataformasDeEstudiantePorEmail(email);

        assertEquals(1, result.size());
        assertEquals("Moodle", result.get(0).nombre());
    }

    @Test
    @DisplayName("Rechaza asignar a un estudiante una plataforma que su proyecto no ofrece")
    void asignarEstudiante_plataformaFueraDelProgramaLanzaError() {
        var programa = new Programa();
        programa.setId(programaId);

        var estudiante = new Estudiante();
        estudiante.setId(estudianteId);
        estudiante.setPrograma(programa);

        when(estudianteRepository.findById(estudianteId)).thenReturn(Optional.of(estudiante));
        when(programaPlataformaRepository.findPlataformaIdsByProgramaId(programaId))
                .thenReturn(List.of(plat1Id));

        var req = new PlataformaAsignacionRequest(List.of(plat2Id));

        assertThrows(BusinessException.class, () -> servicio.asignarEstudiante(estudianteId, req));
        verify(estudiantePlataformaRepository, never()).save(any());
    }

    @Test
    @DisplayName("Devuelve lista vacía si el estudiante no pertenece a ningún proyecto")
    void plataformasDeEstudiante_sinProgramaDevuelveListaVacia() {
        var estudiante = new Estudiante();
        estudiante.setId(estudianteId);
        estudiante.setPrograma(null);

        when(estudianteRepository.findById(estudianteId)).thenReturn(Optional.of(estudiante));

        var result = servicio.plataformasDeEstudiante(estudianteId);

        assertTrue(result.isEmpty());
    }

    @Test
    @DisplayName("Rechaza asignar a un programa una plataforma inactiva o inexistente")
    void asignarPrograma_plataformaInactivaLanzaError() {
        when(programaRepository.findById(programaId)).thenReturn(Optional.of(new Programa()));
        when(plataformaRepository.findAllById(anySet())).thenReturn(List.of());

        var req = new PlataformaAsignacionRequest(List.of(plat1Id));

        assertThrows(BusinessException.class, () -> servicio.asignarPrograma(programaId, req));
        verify(programaPlataformaRepository, never()).save(any());
    }

    @Test
    @DisplayName("Asigna exitosamente plataformas a nivel de proyecto (programa)")
    void asignarPrograma_exito() {
        var programa = new Programa();
        programa.setId(programaId);

        when(programaRepository.findById(programaId)).thenReturn(Optional.of(programa));
        when(programaPlataformaRepository.findByProgramaId(programaId)).thenReturn(List.of());
        var p1 = new Plataforma();
        p1.setId(plat1Id);
        p1.setActivo(true);
        var p2 = new Plataforma();
        p2.setId(plat2Id);
        p2.setActivo(true);
        when(plataformaRepository.findAllById(anySet())).thenReturn(List.of(p1, p2));

        var req = new PlataformaAsignacionRequest(List.of(plat1Id, plat2Id));

        assertDoesNotThrow(() -> servicio.asignarPrograma(programaId, req));

        verify(programaPlataformaRepository, times(2)).save(any(ProgramaPlataforma.class));
    }
}
