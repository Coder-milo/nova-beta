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
    private ConversacionArchivadaRepository archivadas;
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
        archivadas = mock(ConversacionArchivadaRepository.class);
        service = new ChatDirectoService(mensajes, estudiantes, ownership, notificaciones,
                reportes, bloqueos, archivadas);

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

    // ── Archivar ──────────────────────────────────────────────────────────

    private ChatDirectoMensajeRepository.ResumenConversacion resumen(
            UUID otroId, java.time.Instant cuando) {
        var r = mock(ChatDirectoMensajeRepository.ResumenConversacion.class);
        when(r.getOtroId()).thenReturn(otroId);
        when(r.getUltimoMensaje()).thenReturn("hola");
        when(r.getUltimaFecha()).thenReturn(cuando);
        when(r.getMioElUltimo()).thenReturn(false);
        return r;
    }

    private ConversacionArchivadaRepository.Archivada archivadaDesde(
            UUID contactoId, java.time.Instant cuando) {
        var a = mock(ConversacionArchivadaRepository.Archivada.class);
        when(a.getContactoId()).thenReturn(contactoId);
        when(a.getDesde()).thenReturn(cuando);
        return a;
    }

    @Test
    void unaConversacionArchivadaSaleMarcadaComoTal() {
        var otro = estudiante("Luis", programa);
        var hace2h = java.time.Instant.now().minusSeconds(7200);
        // Los mocks se construyen antes: crear uno dentro de un `when` deja el
        // anterior a medias y Mockito lo rechaza.
        var fila = resumen(otro.getId(), hace2h);
        var marca = archivadaDesde(otro.getId(), java.time.Instant.now());
        when(mensajes.conversacionesDe(yo.getId())).thenReturn(List.of(fila));
        when(mensajes.sinLeerPorContacto(yo.getId())).thenReturn(List.of());
        when(estudiantes.findAllById(any())).thenReturn(List.of(otro));
        when(archivadas.archivadasDe(yo.getId())).thenReturn(List.of(marca));

        var lista = service.conversaciones(auth);

        assertEquals(1, lista.size());
        assertTrue(lista.get(0).archivada());
    }

    /**
     * La regla que hace que archivar sea util y no peligroso: apartar una
     * conversacion no puede significar dejar de enterarse de lo que pasa en
     * ella. Si escriben despues de archivarla, vuelve a la bandeja.
     */
    @Test
    void unMensajeNuevoLaDevuelveALaBandeja() {
        var otro = estudiante("Luis", programa);
        var ahora = java.time.Instant.now();
        var hace1h = ahora.minusSeconds(3600);
        var fila = resumen(otro.getId(), ahora);
        var marca = archivadaDesde(otro.getId(), hace1h);
        when(mensajes.conversacionesDe(yo.getId())).thenReturn(List.of(fila));
        when(mensajes.sinLeerPorContacto(yo.getId())).thenReturn(List.of());
        when(estudiantes.findAllById(any())).thenReturn(List.of(otro));
        when(archivadas.archivadasDe(yo.getId())).thenReturn(List.of(marca));

        var lista = service.conversaciones(auth);

        assertFalse(lista.get(0).archivada(),
                "escribieron despues de archivarla: tiene que volver a verse");
    }

    @Test
    void loNoArchivadoNoSaleMarcado() {
        var otro = estudiante("Luis", programa);
        var fila = resumen(otro.getId(), java.time.Instant.now());
        when(mensajes.conversacionesDe(yo.getId())).thenReturn(List.of(fila));
        when(mensajes.sinLeerPorContacto(yo.getId())).thenReturn(List.of());
        when(estudiantes.findAllById(any())).thenReturn(List.of(otro));
        when(archivadas.archivadasDe(yo.getId())).thenReturn(List.of());

        assertFalse(service.conversaciones(auth).get(0).archivada());
    }

    /** Archivar de nuevo cuenta desde ahora, no desde la primera vez. */
    @Test
    void archivarDosVecesRehaceLaMarca() {
        var otro = estudiante("Luis", programa);
        when(estudiantes.findById(otro.getId())).thenReturn(Optional.of(otro));
        var anterior = new ConversacionArchivada();
        when(archivadas.findByEstudianteIdAndContactoId(yo.getId(), otro.getId()))
                .thenReturn(Optional.of(anterior));

        service.archivar(otro.getId(), auth);

        verify(archivadas).delete(anterior);
        verify(archivadas).save(any(ConversacionArchivada.class));
    }

    /** No se archiva una conversacion que no se puede ni abrir. */
    @Test
    void noSeArchivaAAlguienDeOtroProyecto() {
        var ajeno = estudiante("Luis", otroPrograma);
        when(estudiantes.findById(ajeno.getId())).thenReturn(Optional.of(ajeno));

        assertThrows(ResourceNotFoundException.class, () -> service.archivar(ajeno.getId(), auth));
        verify(archivadas, never()).save(any());
    }

    // ── Editar ────────────────────────────────────────────────────────────

    /**
     * La puerta que dejaba abierta el bloqueo. Quien es bloqueado no puede
     * mandar nada nuevo, pero podia reescribir cualquiera de sus mensajes
     * anteriores, y el texto nuevo aparece en la conversacion de la otra
     * persona. Bloquear tiene que cortar tambien eso.
     */
    @Test
    void conBloqueoTampocoSePuedeEditarLoYaEscrito() {
        var otro = estudiante("Luis", programa);
        var mio = mensajeEntre(yo, otro, "lo que escribi antes");
        when(mensajes.findById(mio.getId())).thenReturn(Optional.of(mio));
        when(bloqueos.hayBloqueoEntre(yo.getId(), otro.getId())).thenReturn(true);

        assertThrows(BusinessException.class,
                () -> service.editar(mio.getId(), "texto nuevo", auth));
        assertEquals("lo que escribi antes", mio.getContenido(), "no se toca el contenido");
    }

    @Test
    void sinBloqueoSiSeEdita() {
        var otro = estudiante("Luis", programa);
        var mio = mensajeEntre(yo, otro, "con una errata");
        when(mensajes.findById(mio.getId())).thenReturn(Optional.of(mio));
        when(bloqueos.hayBloqueoEntre(any(), any())).thenReturn(false);

        service.editar(mio.getId(), "sin la errata", auth);

        assertEquals("sin la errata", mio.getContenido());
        assertTrue(mio.isEditado(), "queda marcado como editado");
    }

    @Test
    void soloSeEditaLoPropio() {
        var otro = estudiante("Luis", programa);
        var suyo = mensajeEntre(otro, yo, "lo que escribio el");
        when(mensajes.findById(suyo.getId())).thenReturn(Optional.of(suyo));

        assertThrows(BusinessException.class,
                () -> service.editar(suyo.getId(), "se lo cambio", auth));
    }

    /** Editar tenia que respetar el limite: si no, se salta enviando corto. */
    @Test
    void editarNoSirveParaSaltarseElLimite() {
        var otro = estudiante("Luis", programa);
        var mio = mensajeEntre(yo, otro, "corto");
        when(mensajes.findById(mio.getId())).thenReturn(Optional.of(mio));
        when(bloqueos.hayBloqueoEntre(any(), any())).thenReturn(false);

        assertThrows(BusinessException.class,
                () -> service.editar(mio.getId(), "a".repeat(TextoDeMensaje.MAXIMO + 1), auth));
    }

    // ── Reenviar ──────────────────────────────────────────────────────────

    /**
     * La puerta mas grande que tenia el chat. Se cogia el mensaje por
     * identificador y se copiaba su contenido sin mirar de quien era, asi que
     * con un identificador cualquiera se podia reenviar a uno mismo una
     * conversacion entre otras dos personas y leerla entera sin haber estado
     * nunca en ella.
     */
    @Test
    void noSeReenviaUnMensajeDeOtraConversacion() {
        var luis = estudiante("Luis", programa);
        var sara = estudiante("Sara", programa);
        var ajeno = mensajeEntre(luis, sara, "algo privado entre ellos dos");
        when(mensajes.findById(ajeno.getId())).thenReturn(Optional.of(ajeno));
        when(estudiantes.findById(luis.getId())).thenReturn(Optional.of(luis));

        assertThrows(ResourceNotFoundException.class,
                () -> service.reenviar(ajeno.getId(), luis.getId(), auth));
        verify(mensajes, never()).save(any());
    }

    /** El mismo mensaje que cuando no existe: si no, sirve para comprobar ids. */
    @Test
    void elErrorNoDelataQueEseMensajeExiste() {
        var luis = estudiante("Luis", programa);
        var sara = estudiante("Sara", programa);
        var ajeno = mensajeEntre(luis, sara, "algo privado");
        when(mensajes.findById(ajeno.getId())).thenReturn(Optional.of(ajeno));
        var inventado = UUID.randomUUID();
        when(mensajes.findById(inventado)).thenReturn(Optional.empty());
        when(estudiantes.findById(luis.getId())).thenReturn(Optional.of(luis));

        var deOtros = assertThrows(ResourceNotFoundException.class,
                () -> service.reenviar(ajeno.getId(), luis.getId(), auth));
        var noExiste = assertThrows(ResourceNotFoundException.class,
                () -> service.reenviar(inventado, luis.getId(), auth));

        assertEquals(noExiste.getMessage(), deOtros.getMessage());
    }

    @Test
    void seReenviaLoRecibido() {
        var luis = estudiante("Luis", programa);
        var sara = estudiante("Sara", programa);
        var recibido = mensajeEntre(luis, yo, "mira esto");
        when(mensajes.findById(recibido.getId())).thenReturn(Optional.of(recibido));
        when(estudiantes.findById(sara.getId())).thenReturn(Optional.of(sara));
        when(bloqueos.hayBloqueoEntre(any(), any())).thenReturn(false);

        service.reenviar(recibido.getId(), sara.getId(), auth);

        verify(mensajes).save(any(ChatDirectoMensaje.class));
    }

    @Test
    void seReenviaLoPropio() {
        var luis = estudiante("Luis", programa);
        var sara = estudiante("Sara", programa);
        var mio = mensajeEntre(yo, luis, "lo que dije");
        when(mensajes.findById(mio.getId())).thenReturn(Optional.of(mio));
        when(estudiantes.findById(sara.getId())).thenReturn(Optional.of(sara));
        when(bloqueos.hayBloqueoEntre(any(), any())).thenReturn(false);

        service.reenviar(mio.getId(), sara.getId(), auth);

        verify(mensajes).save(any(ChatDirectoMensaje.class));
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
