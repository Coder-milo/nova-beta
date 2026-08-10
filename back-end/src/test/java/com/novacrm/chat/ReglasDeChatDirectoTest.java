package com.novacrm.chat;

import com.novacrm.auth.OwnershipService;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.notificacion.NotificacionService;
import com.novacrm.programa.Programa;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Las reglas del chat de dos: con quien se puede hablar, a quien se puede
 * bloquear y que se guarda al reportar.
 *
 * <p>Son las que sostienen que esto sea un chat entre companeros de un
 * proyecto y no un directorio de 107 personas reales.
 */
class ReglasDeChatDirectoTest {

    private ChatDirectoMensajeRepository mensajes;
    private EstudianteRepository estudiantes;
    private OwnershipService ownership;
    private NotificacionService notificaciones;
    private ReporteDeChatRepository reportes;
    private BloqueoDeChatRepository bloqueos;
    private ChatDirectoService service;

    private Programa programa;
    private Programa otroPrograma;
    private Estudiante yo;
    private final Authentication auth = mock(Authentication.class);

    @BeforeEach
    void preparar() {
        mensajes = mock(ChatDirectoMensajeRepository.class);
        estudiantes = mock(EstudianteRepository.class);
        ownership = mock(OwnershipService.class);
        notificaciones = mock(NotificacionService.class);
        reportes = mock(ReporteDeChatRepository.class);
        bloqueos = mock(BloqueoDeChatRepository.class);
        service = new ChatDirectoService(mensajes, estudiantes, ownership, notificaciones,
                reportes, bloqueos);

        programa = new Programa();
        programa.setId(UUID.randomUUID());
        otroPrograma = new Programa();
        otroPrograma.setId(UUID.randomUUID());

        yo = estudiante("Ana", programa);
        when(ownership.obtenerEstudianteAutenticado(auth)).thenReturn(yo);
        when(mensajes.save(any(ChatDirectoMensaje.class))).thenAnswer(i -> i.getArgument(0));
        when(bloqueos.sinChatPosibleCon(any())).thenReturn(List.of());
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

    private ChatDirectoMensaje mensajeEntre(Estudiante de, Estudiante para, String texto) {
        var m = new ChatDirectoMensaje();
        m.setId(UUID.randomUUID());
        m.setRemitente(de);
        m.setDestinatario(para);
        m.setContenido(texto);
        return m;
    }

    // ── Con quien se puede hablar ──────────────────────────────────────────

    @Test
    void noSePuedeEscribirAAlguienDeOtroProyecto() {
        var ajeno = estudiante("Luis", otroPrograma);
        when(estudiantes.findById(ajeno.getId())).thenReturn(Optional.of(ajeno));

        assertThrows(ResourceNotFoundException.class,
                () -> service.enviar(ajeno.getId(), "hola", auth));
        verify(mensajes, never()).save(any());
    }

    /**
     * El mismo mensaje que cuando no existe, y a proposito: distinguir "no
     * existe" de "existe pero no es de tu proyecto" convierte este endpoint en
     * una forma de averiguar quien esta en el sistema.
     */
    @Test
    void elErrorNoDelataAQuienEstaEnOtroProyecto() {
        var ajeno = estudiante("Luis", otroPrograma);
        when(estudiantes.findById(ajeno.getId())).thenReturn(Optional.of(ajeno));
        var inventado = UUID.randomUUID();
        when(estudiantes.findById(inventado)).thenReturn(Optional.empty());

        var deOtroProyecto = assertThrows(ResourceNotFoundException.class,
                () -> service.enviar(ajeno.getId(), "hola", auth));
        var queNoExiste = assertThrows(ResourceNotFoundException.class,
                () -> service.enviar(inventado, "hola", auth));

        assertEquals(queNoExiste.getMessage(), deOtroProyecto.getMessage());
    }

    @Test
    void noSePuedeEscribirAUnaCuentaDadaDeBaja() {
        var retirado = estudiante("Luis", programa);
        retirado.setActivo(false);
        when(estudiantes.findById(retirado.getId())).thenReturn(Optional.of(retirado));

        assertThrows(ResourceNotFoundException.class,
                () -> service.enviar(retirado.getId(), "hola", auth));
    }

    @Test
    void seEscribeAUnCompaneroDelMismoProyecto() {
        var companero = estudiante("Luis", programa);
        when(estudiantes.findById(companero.getId())).thenReturn(Optional.of(companero));
        when(bloqueos.hayBloqueoEntre(any(), any())).thenReturn(false);

        service.enviar(companero.getId(), "hola", auth);

        verify(mensajes).save(any(ChatDirectoMensaje.class));
        verify(notificaciones).registrarMensajeDeCompanero(eq(companero), eq(yo.getId()), any());
    }

    // ── Bloqueo ───────────────────────────────────────────────────────────

    /**
     * Lo importante del bloqueo: corta en las dos direcciones aunque se guarde
     * en una. Si solo cortara el sentido de quien bloquea hacia quien es
     * bloqueado, el que bloquea podria seguir escribiendo, y la herramienta
     * para protegerse serviria para insistir.
     */
    @Test
    void conBloqueoNoSeEnviaEnNingunaDireccion() {
        var otro = estudiante("Luis", programa);
        when(estudiantes.findById(otro.getId())).thenReturn(Optional.of(otro));
        when(bloqueos.hayBloqueoEntre(yo.getId(), otro.getId())).thenReturn(true);

        assertThrows(BusinessException.class, () -> service.enviar(otro.getId(), "hola", auth));
        verify(mensajes, never()).save(any());
    }

    /** El aviso no dice quien bloqueo a quien: eso es informacion del otro. */
    @Test
    void elAvisoDeBloqueoNoDiceQuienBloqueo() {
        var otro = estudiante("Luis", programa);
        when(estudiantes.findById(otro.getId())).thenReturn(Optional.of(otro));
        when(bloqueos.hayBloqueoEntre(any(), any())).thenReturn(true);

        var ex = assertThrows(BusinessException.class, () -> service.enviar(otro.getId(), "hola", auth));

        var texto = ex.getMessage().toLowerCase();
        assertFalse(texto.contains("bloque"), "el mensaje no debe revelar que hay un bloqueo");
    }

    @Test
    void bloquearGuardaElBloqueoUnaSolaVez() {
        var otro = estudiante("Luis", programa);
        when(estudiantes.findById(otro.getId())).thenReturn(Optional.of(otro));
        when(bloqueos.findByBloqueadorIdAndBloqueadoId(yo.getId(), otro.getId()))
                .thenReturn(Optional.empty());

        service.bloquear(otro.getId(), auth);
        verify(bloqueos).save(any(BloqueoDeChat.class));

        // Pulsarlo otra vez no es un error ni crea un segundo bloqueo.
        reset(bloqueos);
        when(bloqueos.findByBloqueadorIdAndBloqueadoId(yo.getId(), otro.getId()))
                .thenReturn(Optional.of(new BloqueoDeChat()));
        service.bloquear(otro.getId(), auth);
        verify(bloqueos, never()).save(any(BloqueoDeChat.class));
    }

    @Test
    void noSePuedeUnoBloquearseASiMismo() {
        assertThrows(BusinessException.class, () -> service.bloquear(yo.getId(), auth));
    }

    /** A quien bloqueaste, y quien te bloqueo, no se ofrece al buscar. */
    @Test
    void elBuscadorNoOfreceAQuienNoSePuedeEscribir() {
        var visible = estudiante("Luisa", programa);
        var bloqueado = estudiante("Luis", programa);
        when(estudiantes.companerosQueCoinciden(any(), any(), any(), any()))
                .thenReturn(List.of(visible, bloqueado));
        when(bloqueos.sinChatPosibleCon(yo.getId())).thenReturn(List.of(bloqueado.getId()));

        var resultado = service.contactos("lui", auth);

        assertEquals(1, resultado.size());
        assertEquals(visible.getId(), resultado.get(0).id());
    }

    /**
     * Aqui habia un plan B que recorria toda la base comparando nombres: si en
     * tu proyecto no habia ninguna Ana, salian las Anas de los demas proyectos.
     * Sin resultados es la respuesta correcta.
     */
    @Test
    void sinCoincidenciasEnElProyectoNoSeBuscaEnLosDemas() {
        when(estudiantes.companerosQueCoinciden(any(), any(), any(), any())).thenReturn(List.of());

        var resultado = service.contactos("ana", auth);

        assertTrue(resultado.isEmpty());
        verify(estudiantes, never()).findAll();
    }

    // ── Reportar ──────────────────────────────────────────────────────────

    /** Sin conversacion, el boton serviria para denunciar a desconocidos. */
    @Test
    void noSeReportaAQuienNuncaTeEscribio() {
        var otro = estudiante("Luis", programa);
        when(estudiantes.findById(otro.getId())).thenReturn(Optional.of(otro));
        when(mensajes.ultimosDeLaConversacion(any(), any(), any())).thenReturn(List.of());

        assertThrows(BusinessException.class, () -> service.reportar(otro.getId(), "algo", auth));
        verify(reportes, never()).save(any());
    }

    /**
     * Se puede reportar a quien ya se fue del proyecto, que es justo cuando mas
     * falta hace: reportar no pasa por contactoValido.
     */
    @Test
    void seReportaAQuienYaNoEstaEnElProyecto() {
        var seFue = estudiante("Luis", otroPrograma);
        when(estudiantes.findById(seFue.getId())).thenReturn(Optional.of(seFue));
        when(mensajes.ultimosDeLaConversacion(any(), any(), any()))
                .thenReturn(List.of(mensajeEntre(seFue, yo, "lo que escribio")));

        service.reportar(seFue.getId(), "me escribio algo feo", auth);

        verify(reportes).save(any(ReporteDeChat.class));
    }

    /**
     * El extracto se copia y no se apunta a los mensajes: quien acosa borra, y
     * un reporte que apunta a mensajes borrados no le sirve a nadie.
     */
    @Test
    void elReporteGuardaCopiaDeLoEscrito() {
        var otro = estudiante("Luis", programa);
        when(estudiantes.findById(otro.getId())).thenReturn(Optional.of(otro));
        when(mensajes.ultimosDeLaConversacion(any(), any(), any()))
                .thenReturn(List.of(mensajeEntre(otro, yo, "lo que escribio")));

        var capturado = org.mockito.ArgumentCaptor.forClass(ReporteDeChat.class);
        service.reportar(otro.getId(), "me escribio algo feo", auth);
        verify(reportes).save(capturado.capture());

        var reporte = capturado.getValue();
        assertEquals(yo.getId(), reporte.getDenunciante().getId());
        assertEquals(otro.getId(), reporte.getDenunciado().getId());
        assertTrue(reporte.getExtracto().contains("lo que escribio"));
        assertEquals(ReporteDeChat.ABIERTO, reporte.getEstado());
    }

    @Test
    void noSeApilanReportesDelMismoCaso() {
        var otro = estudiante("Luis", programa);
        when(estudiantes.findById(otro.getId())).thenReturn(Optional.of(otro));
        when(mensajes.ultimosDeLaConversacion(any(), any(), any()))
                .thenReturn(List.of(mensajeEntre(otro, yo, "algo")));
        when(reportes.existsByDenuncianteIdAndDenunciadoIdAndEstado(
                yo.getId(), otro.getId(), ReporteDeChat.ABIERTO)).thenReturn(true);

        assertThrows(BusinessException.class, () -> service.reportar(otro.getId(), null, auth));
        verify(reportes, never()).save(any());
    }

    @Test
    void noSePuedeUnoReportarseASiMismo() {
        assertThrows(BusinessException.class, () -> service.reportar(yo.getId(), null, auth));
    }
}
