package com.novacrm.chat;

import com.novacrm.auth.OwnershipService;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.programa.Programa;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

/**
 * Las reglas de los grupos del chat.
 *
 * <p>Son reglas de convivencia, no de negocio: quien puede sacar a quien, que
 * pasa cuando se va el ultimo, a quien se admite en un grupo. Se rompen en
 * silencio —nadie ve un error, simplemente alguien acaba donde no deberia— y
 * por eso conviene fijarlas.
 */
class ReglasDeGrupoTest {

    private ChatGrupoRepository grupos;
    private ChatGrupoMiembroRepository miembros;
    private ChatGrupoMensajeRepository mensajes;
    private EstudianteRepository estudiantes;
    private OwnershipService ownership;
    private ReporteDeChatRepository reportes;
    private ChatGrupoService service;

    private Programa programa;
    private Programa otroPrograma;
    private Estudiante yo;
    private final Authentication auth = mock(Authentication.class);

    @BeforeEach
    void preparar() {
        grupos = mock(ChatGrupoRepository.class);
        miembros = mock(ChatGrupoMiembroRepository.class);
        mensajes = mock(ChatGrupoMensajeRepository.class);
        estudiantes = mock(EstudianteRepository.class);
        ownership = mock(OwnershipService.class);
        reportes = mock(ReporteDeChatRepository.class);
        service = new ChatGrupoService(grupos, miembros, mensajes, estudiantes, ownership, reportes);

        programa = new Programa();
        programa.setId(UUID.randomUUID());
        otroPrograma = new Programa();
        otroPrograma.setId(UUID.randomUUID());

        yo = estudiante("Ana", programa);
        when(ownership.obtenerEstudianteAutenticado(auth)).thenReturn(yo);
        when(grupos.save(any(ChatGrupo.class))).thenAnswer(i -> i.getArgument(0));
        when(miembros.save(any(ChatGrupoMiembro.class))).thenAnswer(i -> i.getArgument(0));
        when(miembros.findByGrupoId(any())).thenReturn(List.of());
    }

    private Estudiante estudiante(String nombre, Programa suPrograma) {
        var e = new Estudiante();
        e.setId(UUID.randomUUID());
        e.setNombre(nombre);
        e.setApellido("Apellido");
        e.setActivo(true);
        e.setPrograma(suPrograma);
        return e;
    }

    private ChatGrupoMiembro miembro(ChatGrupo grupo, Estudiante estudiante, boolean esAdmin) {
        var m = new ChatGrupoMiembro();
        m.setId(UUID.randomUUID());
        m.setGrupo(grupo);
        m.setEstudiante(estudiante);
        m.setEsAdmin(esAdmin);
        return m;
    }

    private ChatGrupo grupo() {
        var g = new ChatGrupo();
        g.setId(UUID.randomUUID());
        g.setNombre("Estudio");
        return g;
    }

    // ── Quien entra en un grupo ────────────────────────────────────────────

    /**
     * Sin esto bastaba con conocer un id para meter en un grupo a alguien de
     * otro proyecto, y a partir de ahi todos se leen entre si.
     */
    @Test
    void noSeAdmiteAAlguienDeOtroProyecto() {
        var deOtroLado = estudiante("Luis", otroPrograma);
        when(estudiantes.findById(deOtroLado.getId())).thenReturn(Optional.of(deOtroLado));

        service.crearGrupo(new ChatGrupoService.CrearGrupoRequest(
                "Estudio", null, List.of(deOtroLado.getId())), auth);

        // Solo se guarda un miembro: la creadora.
        verify(miembros, times(1)).save(any(ChatGrupoMiembro.class));
    }

    @Test
    void noSeAdmiteAUnaCuentaDadaDeBaja() {
        var retirado = estudiante("Luis", programa);
        retirado.setActivo(false);
        when(estudiantes.findById(retirado.getId())).thenReturn(Optional.of(retirado));

        service.crearGrupo(new ChatGrupoService.CrearGrupoRequest(
                "Estudio", null, List.of(retirado.getId())), auth);

        verify(miembros, times(1)).save(any(ChatGrupoMiembro.class));
    }

    @Test
    void seAdmiteAUnCompaneroDelMismoProyecto() {
        var companero = estudiante("Luis", programa);
        when(estudiantes.findById(companero.getId())).thenReturn(Optional.of(companero));

        service.crearGrupo(new ChatGrupoService.CrearGrupoRequest(
                "Estudio", null, List.of(companero.getId())), auth);

        verify(miembros, times(2)).save(any(ChatGrupoMiembro.class));
    }

    /** El mismo id repetido en la invitacion no debe entrar dos veces. */
    @Test
    void unIdRepetidoNoEntraDosVeces() {
        var companero = estudiante("Luis", programa);
        when(estudiantes.findById(companero.getId())).thenReturn(Optional.of(companero));

        service.crearGrupo(new ChatGrupoService.CrearGrupoRequest(
                "Estudio", null, List.of(companero.getId(), companero.getId())), auth);

        verify(miembros, times(2)).save(any(ChatGrupoMiembro.class));
    }

    @Test
    void hayUnTopeDeGente() {
        var muchos = new java.util.ArrayList<UUID>();
        for (int i = 0; i < 61; i++) muchos.add(UUID.randomUUID());

        var ex = assertThrows(BusinessException.class, () -> service.crearGrupo(
                new ChatGrupoService.CrearGrupoRequest("Estudio", null, muchos), auth));
        assertTrue(ex.getMessage().contains("60"));
    }

    // ── Salir ──────────────────────────────────────────────────────────────

    /**
     * Un grupo sin nadie no lo puede volver a abrir ninguno de los dos lados, y
     * sus mensajes quedarian guardados sin que nadie pueda leerlos.
     */
    @Test
    void siSeVaElUltimoElGrupoSeBorra() {
        var g = grupo();
        var soloYo = miembro(g, yo, true);
        when(miembros.findByGrupoIdAndEstudianteId(g.getId(), yo.getId())).thenReturn(Optional.of(soloYo));
        when(miembros.findByGrupoIdOrderByCreatedAtAsc(g.getId())).thenReturn(List.of(soloYo));

        service.salir(g.getId(), auth);

        verify(miembros).delete(soloYo);
        verify(grupos).deleteById(g.getId());
    }

    /** Si no, quedaria un grupo vivo que nadie puede administrar. */
    @Test
    void siSeVaElUnicoAdminHeredaElQueLlevaMasTiempo() {
        var g = grupo();
        var yoAdmin = miembro(g, yo, true);
        var antiguo = miembro(g, estudiante("Luis", programa), false);
        var reciente = miembro(g, estudiante("Sara", programa), false);
        when(miembros.findByGrupoIdAndEstudianteId(g.getId(), yo.getId())).thenReturn(Optional.of(yoAdmin));
        when(miembros.findByGrupoIdOrderByCreatedAtAsc(g.getId()))
                .thenReturn(List.of(yoAdmin, antiguo, reciente));

        service.salir(g.getId(), auth);

        assertTrue(antiguo.isEsAdmin(), "el que lleva mas tiempo hereda");
        assertFalse(reciente.isEsAdmin());
        verify(grupos, never()).deleteById(any());
    }

    @Test
    void siQuedaOtroAdminNoHeredaNadie() {
        var g = grupo();
        var yoMiembro = miembro(g, yo, false);
        var otroAdmin = miembro(g, estudiante("Luis", programa), true);
        when(miembros.findByGrupoIdAndEstudianteId(g.getId(), yo.getId())).thenReturn(Optional.of(yoMiembro));
        when(miembros.findByGrupoIdOrderByCreatedAtAsc(g.getId())).thenReturn(List.of(yoMiembro, otroAdmin));

        service.salir(g.getId(), auth);

        verify(miembros, never()).save(any(ChatGrupoMiembro.class));
    }

    @Test
    void noSePuedeSalirDeUnGrupoAlQueNoPerteneces() {
        var g = grupo();
        when(miembros.findByGrupoIdAndEstudianteId(g.getId(), yo.getId())).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.salir(g.getId(), auth));
    }

    // ── Expulsar ───────────────────────────────────────────────────────────

    @Test
    void soloUnAdminPuedeSacarAAlguien() {
        var g = grupo();
        var otro = estudiante("Luis", programa);
        when(miembros.findByGrupoIdAndEstudianteId(g.getId(), yo.getId()))
                .thenReturn(Optional.of(miembro(g, yo, false)));

        var ex = assertThrows(BusinessException.class,
                () -> service.expulsar(g.getId(), otro.getId(), auth));
        assertTrue(ex.getMessage().toLowerCase().contains("administrador"));
    }

    /** Evita la pelea de dos personas sacandose la una a la otra. */
    @Test
    void unAdminNoPuedeSacarAOtroAdmin() {
        var g = grupo();
        var otro = estudiante("Luis", programa);
        when(miembros.findByGrupoIdAndEstudianteId(g.getId(), yo.getId()))
                .thenReturn(Optional.of(miembro(g, yo, true)));
        when(miembros.findByGrupoIdAndEstudianteId(g.getId(), otro.getId()))
                .thenReturn(Optional.of(miembro(g, otro, true)));

        assertThrows(BusinessException.class, () -> service.expulsar(g.getId(), otro.getId(), auth));
    }

    @Test
    void sacarseUnoMismoRemiteASalir() {
        var g = grupo();
        when(miembros.findByGrupoIdAndEstudianteId(g.getId(), yo.getId()))
                .thenReturn(Optional.of(miembro(g, yo, true)));

        var ex = assertThrows(BusinessException.class,
                () -> service.expulsar(g.getId(), yo.getId(), auth));
        assertTrue(ex.getMessage().toLowerCase().contains("salir"));
    }

    @Test
    void unAdminSacaAUnMiembroNormal() {
        var g = grupo();
        var otro = estudiante("Luis", programa);
        var suFila = miembro(g, otro, false);
        when(miembros.findByGrupoIdAndEstudianteId(g.getId(), yo.getId()))
                .thenReturn(Optional.of(miembro(g, yo, true)));
        when(miembros.findByGrupoIdAndEstudianteId(g.getId(), otro.getId()))
                .thenReturn(Optional.of(suFila));

        service.expulsar(g.getId(), otro.getId(), auth);

        verify(miembros).delete(suFila);
    }

    // ── Reportar ───────────────────────────────────────────────────────────

    @Test
    void soloReportaQuienEstaEnElGrupo() {
        var g = grupo();
        var otro = estudiante("Luis", programa);
        when(miembros.existsByGrupoIdAndEstudianteId(g.getId(), yo.getId())).thenReturn(false);

        assertThrows(BusinessException.class,
                () -> service.reportar(g.getId(), otro.getId(), "algo", auth));
        verify(reportes, never()).save(any());
    }

    /**
     * El extracto guarda la conversacion del grupo, tambien lo de otros: una
     * frase suelta sin lo que se dijo antes y despues casi nunca se entiende.
     */
    @Test
    void elReporteGuardaLaConversacionDelGrupo() {
        var g = grupo();
        var otro = estudiante("Luis", programa);
        when(miembros.existsByGrupoIdAndEstudianteId(g.getId(), yo.getId())).thenReturn(true);
        when(grupos.findById(g.getId())).thenReturn(Optional.of(g));
        when(estudiantes.findById(otro.getId())).thenReturn(Optional.of(otro));
        when(reportes.existsByDenuncianteIdAndDenunciadoIdAndEstado(any(), any(), any())).thenReturn(false);

        var suyo = new ChatGrupoMensaje();
        suyo.setGrupo(g);
        suyo.setRemitente(otro);
        suyo.setContenido("lo que escribio");
        var mio = new ChatGrupoMensaje();
        mio.setGrupo(g);
        mio.setRemitente(yo);
        mio.setContenido("lo que respondi");
        when(mensajes.findByGrupoIdOrderByCreatedAtDesc(eq(g.getId()), any()))
                .thenReturn(List.of(mio, suyo));

        var capturado = org.mockito.ArgumentCaptor.forClass(ReporteDeChat.class);
        service.reportar(g.getId(), otro.getId(), "me escribio algo feo", auth);
        verify(reportes).save(capturado.capture());

        var reporte = capturado.getValue();
        assertEquals(otro.getId(), reporte.getDenunciado().getId());
        assertEquals(yo.getId(), reporte.getDenunciante().getId());
        assertTrue(reporte.getExtracto().contains("lo que escribio"));
        assertTrue(reporte.getExtracto().contains("lo que respondi"),
                "sin el contexto de los demas, una frase suelta no se entiende");
        assertTrue(reporte.getExtracto().contains("Estudio"), "dice de que grupo salio");
    }

    @Test
    void noSePuedeReportarUnoMismo() {
        var g = grupo();
        when(miembros.existsByGrupoIdAndEstudianteId(g.getId(), yo.getId())).thenReturn(true);

        assertThrows(BusinessException.class,
                () -> service.reportar(g.getId(), yo.getId(), null, auth));
    }

    /** Pulsarlo dos veces no debe llenar la bandeja del equipo del mismo caso. */
    @Test
    void noSeApilanReportesDelMismoCaso() {
        var g = grupo();
        var otro = estudiante("Luis", programa);
        when(miembros.existsByGrupoIdAndEstudianteId(g.getId(), yo.getId())).thenReturn(true);
        when(grupos.findById(g.getId())).thenReturn(Optional.of(g));
        when(estudiantes.findById(otro.getId())).thenReturn(Optional.of(otro));
        when(reportes.existsByDenuncianteIdAndDenunciadoIdAndEstado(
                yo.getId(), otro.getId(), ReporteDeChat.ABIERTO)).thenReturn(true);

        assertThrows(BusinessException.class,
                () -> service.reportar(g.getId(), otro.getId(), null, auth));
        verify(reportes, never()).save(any());
    }

    // ── Miembros ───────────────────────────────────────────────────────────

    /** Con quien se junta la gente no es de dominio publico en el proyecto. */
    @Test
    void laListaDeMiembrosSoloLaVenLosMiembros() {
        var g = grupo();
        when(miembros.existsByGrupoIdAndEstudianteId(g.getId(), yo.getId())).thenReturn(false);

        assertThrows(BusinessException.class, () -> service.miembros(g.getId(), auth));
    }

    @Test
    void laListaDiceQuienEsUnoYQuienAdministra() {
        var g = grupo();
        var otro = estudiante("Luis", programa);
        when(miembros.existsByGrupoIdAndEstudianteId(g.getId(), yo.getId())).thenReturn(true);
        when(miembros.findByGrupoIdOrderByCreatedAtAsc(g.getId()))
                .thenReturn(List.of(miembro(g, yo, true), miembro(g, otro, false)));

        var lista = service.miembros(g.getId(), auth);

        assertEquals(2, lista.size());
        assertTrue(lista.get(0).soyYo());
        assertTrue(lista.get(0).esAdmin());
        assertFalse(lista.get(1).soyYo());
        assertFalse(lista.get(1).esAdmin());
    }
}
