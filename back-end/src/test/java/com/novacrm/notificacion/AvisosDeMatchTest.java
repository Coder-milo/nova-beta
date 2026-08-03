package com.novacrm.notificacion;

import com.novacrm.auth.OwnershipService;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.matching.Match;
import com.novacrm.matching.MatchRepository;
import com.novacrm.vacante.Vacante;
import com.novacrm.whatsapp.WhatsappAvisosService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Fan-out de los avisos de una corrida de matching.
 *
 * <p>El motor puede producir miles de matches en una sola ejecución: hasta 500
 * vacantes contra ~107 participantes activos. Emitir una notificación y una
 * plantilla de WhatsApp por cada uno —como se hacía— deja la bandeja del
 * estudiante inservible y convierte una corrida del programador en una factura.
 */
class AvisosDeMatchTest {

    private NotificacionRepository notificacionRepository;
    private MatchRepository matchRepository;
    private WhatsappAvisosService whatsappAvisosService;
    private NotificacionService notificacionService;

    @BeforeEach
    void configurar() {
        notificacionRepository = mock(NotificacionRepository.class);
        matchRepository = mock(MatchRepository.class);
        whatsappAvisosService = mock(WhatsappAvisosService.class);
        notificacionService = new NotificacionService(
                notificacionRepository, matchRepository,
                mock(OwnershipService.class), mock(EstudianteRepository.class),
                whatsappAvisosService);
    }

    private Match match(Estudiante estudiante, String titulo, double puntaje) {
        var vacante = new Vacante();
        vacante.setTitulo(titulo);
        var m = new Match();
        m.setEstudiante(estudiante);
        m.setVacante(vacante);
        m.setPuntaje(BigDecimal.valueOf(puntaje));
        return m;
    }

    private List<Notificacion> notificacionesGuardadas() {
        var captor = ArgumentCaptor.forClass(Notificacion.class);
        verify(notificacionRepository, atLeast(0)).save(captor.capture());
        return captor.getAllValues();
    }

    @SuppressWarnings("unchecked")
    private List<Match> matchesAvisadosPorWhatsapp() {
        var captor = ArgumentCaptor.forClass(List.class);
        verify(whatsappAvisosService).avisarMatches(captor.capture());
        return captor.getValue();
    }

    @Test
    void cadaEstudianteRecibeUnaSolaNotificacionPorCorrida() {
        var ana = new Estudiante();
        var luis = new Estudiante();
        var matches = new ArrayList<Match>();
        for (int i = 0; i < 12; i++) {
            matches.add(match(ana, "Vacante " + i, 60 + i));
        }
        matches.add(match(luis, "Agente bilingue", 72));

        notificacionService.generarNotificacionesMatch(matches);

        var guardadas = notificacionesGuardadas();
        assertEquals(2, guardadas.size(),
                "una notificacion por estudiante, no una por match");
    }

    @Test
    void elResumenDiceCuantasVacantesSonYNombraLasMejores() {
        var ana = new Estudiante();
        var matches = List.of(
                match(ana, "Auxiliar de bodega", 58),
                match(ana, "Agente bilingue inbound", 91),
                match(ana, "Customer service representative", 84),
                match(ana, "Data entry", 70),
                match(ana, "Recepcionista", 63));

        notificacionService.generarNotificacionesMatch(matches);

        var resumen = notificacionesGuardadas().get(0);
        assertTrue(resumen.getMensaje().contains("5 vacantes"), resumen.getMensaje());
        assertTrue(resumen.getMensaje().contains("Agente bilingue inbound"),
                "el mejor match debe nombrarse: " + resumen.getMensaje());
        assertTrue(resumen.getMensaje().contains("y 2 mas")
                        || resumen.getMensaje().contains("y 2 más"),
                "los que no caben se cuentan: " + resumen.getMensaje());
        assertFalse(resumen.getMensaje().contains("Recepcionista"),
                "solo se nombran los mejores: " + resumen.getMensaje());
    }

    @Test
    void unSoloMatchConservaElMensajeEnSingular() {
        var ana = new Estudiante();

        notificacionService.generarNotificacionesMatch(List.of(match(ana, "Agente bilingue", 80)));

        var resumen = notificacionesGuardadas().get(0);
        assertEquals("Nueva vacante recomendada", resumen.getTitulo());
        assertTrue(resumen.getMensaje().contains("Agente bilingue"), resumen.getMensaje());
    }

    /**
     * WhatsApp se cobra por plantilla enviada, así que el tope es mas estricto
     * que el de la bandeja. Se conservan los botones de si/no de los mejores
     * matches porque son la unica etiqueta que devuelve el estudiante.
     */
    @Test
    void aWhatsappSoloVanLosMejoresMatchesDeCadaEstudiante() {
        var ana = new Estudiante();
        var luis = new Estudiante();
        var matches = new ArrayList<Match>();
        for (int i = 0; i < 10; i++) {
            matches.add(match(ana, "Vacante " + i, 60 + i));
        }
        matches.add(match(luis, "Agente bilingue", 72));

        notificacionService.generarNotificacionesMatch(matches);

        var avisados = matchesAvisadosPorWhatsapp();
        assertEquals(NotificacionService.TOPE_WHATSAPP + 1, avisados.size(),
                "tope por estudiante, no por corrida entera");

        var deAna = avisados.stream().filter(m -> m.getEstudiante() == ana).toList();
        assertEquals(NotificacionService.TOPE_WHATSAPP, deAna.size());
        assertEquals(List.of("Vacante 9", "Vacante 8", "Vacante 7"),
                deAna.stream().map(m -> m.getVacante().getTitulo()).toList(),
                "el cupo se lo llevan los de mayor puntaje");
    }

    /** Todos quedan marcados, tambien los que no llegaron a WhatsApp. */
    @Test
    void todosLosMatchesQuedanMarcadosComoNotificados() {
        var ana = new Estudiante();
        var matches = new ArrayList<Match>();
        for (int i = 0; i < 8; i++) {
            matches.add(match(ana, "Vacante " + i, 60 + i));
        }

        notificacionService.generarNotificacionesMatch(matches);

        assertTrue(matches.stream().allMatch(Match::isNotificado),
                "un match no marcado se volveria a notificar en la siguiente corrida");
    }

    @Test
    void unaCorridaSinMatchesNoAvisaANadie() {
        notificacionService.generarNotificacionesMatch(List.of());

        verifyNoInteractions(notificacionRepository);
        verifyNoInteractions(whatsappAvisosService);
        verify(matchRepository, never()).saveAll(any());
    }
}
