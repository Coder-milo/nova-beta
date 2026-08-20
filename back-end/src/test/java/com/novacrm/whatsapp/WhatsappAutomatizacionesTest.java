package com.novacrm.whatsapp;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.matching.Match;
import com.novacrm.matching.MatchRepository;
import com.novacrm.postulacion.Postulacion;
import com.novacrm.postulacion.PostulacionRepository;
import com.novacrm.programa.Programa;
import com.novacrm.seguimiento.Seguimiento;
import com.novacrm.seguimiento.SeguimientoRepository;
import com.novacrm.vacante.Vacante;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WhatsappAutomatizacionesTest {

    @Mock private EstudianteRepository estudianteRepository;
    @Mock private PostulacionRepository postulacionRepository;
    @Mock private MatchRepository matchRepository;
    @Mock private SeguimientoRepository seguimientoRepository;
    @Mock private MensajeWhatsappRepository mensajesRepository;
    @Mock private ProgramaWhatsappRepository whatsappRepository;
    @Mock private WhatsappSender whatsappSender;

    private WhatsappAutomatizacionesService service;

    @BeforeEach
    void setup() {
        service = new WhatsappAutomatizacionesService(
                estudianteRepository, postulacionRepository, matchRepository,
                seguimientoRepository, mensajesRepository, whatsappRepository,
                whatsappSender);
    }

    @Test
    void detectaEstudianteInactivoConVacantesCompatibles() {
        UUID programaId = UUID.randomUUID();
        Programa programa = new Programa();
        programa.setId(programaId);
        programa.setNombre("Ruta Accelerator");

        Estudiante e = new Estudiante();
        e.setId(UUID.randomUUID());
        e.setNombre("Juan");
        e.setApellido("Perez");
        e.setCelular("+573001234567");
        e.setPrograma(programa);
        e.setActivo(true);

        Postulacion p = new Postulacion();
        p.setFechaPostulacion(LocalDate.now().minusDays(15));

        Vacante v = new Vacante();
        v.setTitulo("Bilingual Agent");

        Match m = new Match();
        m.setVacante(v);
        m.setPuntaje(java.math.BigDecimal.valueOf(90));

        when(estudianteRepository.findAllByProgramaIdAndActivoTrue(programaId)).thenReturn(List.of(e));
        when(postulacionRepository.findByEstudianteIdOrderByFechaPostulacionDesc(e.getId())).thenReturn(List.of(p));
        when(matchRepository.findVigentesDeEstudiante(eq(e.getId()), any(LocalDateTime.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(m)));

        var resumen = service.ejecutarNudgeInactividad(programaId, 7, true);

        assertEquals(1, resumen.elegibles());
        assertEquals(0, resumen.enviados(), "En simulacion no debe enviar");
        assertTrue(resumen.simulacion());
        assertEquals(1, resumen.candidatos().size());
        assertEquals(15, resumen.candidatos().get(0).diasInactivo());
        assertEquals(1, resumen.candidatos().get(0).vacantesCompatibles());
    }

    @Test
    void envioRealRegistraSeguimientoYRespetaCooldown() {
        UUID programaId = UUID.randomUUID();
        Programa programa = new Programa();
        programa.setId(programaId);
        programa.setNombre("Ruta Accelerator");

        Estudiante e = new Estudiante();
        e.setId(UUID.randomUUID());
        e.setNombre("Maria");
        e.setCelular("+573009876543");
        e.setPrograma(programa);
        e.setActivo(true);

        Postulacion p = new Postulacion();
        p.setFechaPostulacion(LocalDate.now().minusDays(10));

        Vacante v = new Vacante();
        v.setTitulo("Support Analyst");

        Match m = new Match();
        m.setVacante(v);
        m.setPuntaje(java.math.BigDecimal.valueOf(88));

        when(estudianteRepository.findAllByProgramaIdAndActivoTrue(programaId)).thenReturn(List.of(e));
        when(postulacionRepository.findByEstudianteIdOrderByFechaPostulacionDesc(e.getId())).thenReturn(List.of(p));
        when(matchRepository.findVigentesDeEstudiante(eq(e.getId()), any(LocalDateTime.class), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(m)));
        when(mensajesRepository.existsByEstudianteIdAndTipoAndCreatedAtAfter(eq(e.getId()), any(), any())).thenReturn(false);
        when(whatsappSender.estaConfigurado(programaId)).thenReturn(true);
        when(whatsappSender.enviarPlantilla(eq(programaId), eq("+573009876543"), anyString(), anyList(), anyList()))
                .thenReturn(WhatsappSender.Resultado.ok());

        var resumen = service.ejecutarNudgeInactividad(programaId, 7, false);

        assertEquals(1, resumen.enviados());
        verify(seguimientoRepository, times(1)).save(any(Seguimiento.class));
        verify(mensajesRepository, times(1)).save(any(MensajeWhatsapp.class));
    }
}
