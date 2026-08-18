package com.novacrm.notificacion;

import com.novacrm.auth.OwnershipService;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.matching.Match;
import com.novacrm.matching.MatchRepository;
import com.novacrm.notificacion.dto.NotificacionResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class NotificacionService {

    /** Anuncio general del coordinador (feria de empleo, convocatoria, aviso). */
    public static final String TIPO_ANUNCIO = "ANUNCIO";
    private static final String TIPO_CHAT = "CHAT";

    private final NotificacionRepository notificacionRepository;
    private final MatchRepository matchRepository;
    private final OwnershipService ownershipService;
    private final com.novacrm.estudiante.EstudianteRepository estudianteRepository;
    private final com.novacrm.whatsapp.WhatsappAvisosService whatsappAvisosService;

    public NotificacionService(NotificacionRepository notificacionRepository,
                               MatchRepository matchRepository,
                               OwnershipService ownershipService,
                               com.novacrm.estudiante.EstudianteRepository estudianteRepository,
                               com.novacrm.whatsapp.WhatsappAvisosService whatsappAvisosService) {
        this.notificacionRepository = notificacionRepository;
        this.matchRepository = matchRepository;
        this.ownershipService = ownershipService;
        this.estudianteRepository = estudianteRepository;
        this.whatsappAvisosService = whatsappAvisosService;
    }

    /**
     * Publica un anuncio para todos los estudiantes activos.
     *
     * <p>Se crea una notificacion por estudiante en lugar de una sola global
     * porque cada uno la marca como leida por separado; con un unico registro
     * compartido no habria forma de saber quien la vio.
     *
     * @param porWhatsapp si ademas se avisa por WhatsApp; solo cuando el canal
     *                    del programa esta activo y la plantilla aprobada
     * @return cuantos recibieron el anuncio en el panel y cuantos ademas por
     *         WhatsApp, que no tienen por que coincidir
     */
    public record ResultadoAnuncio(int destinatarios, int porWhatsapp) {}

    @Transactional
    public ResultadoAnuncio publicarAnuncio(String titulo, String mensaje, UUID programaId,
                               String mediaUrl, String mediaTipo, boolean porWhatsapp) {
        var destinatarios = programaId == null
                ? estudianteRepository.findAllByActivoTrue()
                : estudianteRepository.findAllByProgramaIdAndActivoTrue(programaId);

        if (destinatarios.isEmpty()) {
            return new ResultadoAnuncio(0, 0);
        }

        var notificaciones = destinatarios.stream().map(estudiante -> {
            var n = new Notificacion();
            n.setEstudiante(estudiante);
            n.setTitulo(titulo);
            n.setMensaje(mensaje);
            n.setTipo(TIPO_ANUNCIO);
            n.setMediaUrl(mediaUrl);
            n.setMediaTipo(mediaTipo);
            return n;
        }).toList();

        notificacionRepository.saveAll(notificaciones);

        // Opt-in por anuncio: el coordinador decide en cada publicacion si
        // ademas del panel quiere llegar al celular de la gente.
        int enviadosPorWhatsapp = 0;
        if (porWhatsapp) {
            for (var estudiante : destinatarios) {
                if (whatsappAvisosService.avisarAnuncio(estudiante, titulo,
                        com.novacrm.config.TextoPlano.deHtml(mensaje))) {
                    enviadosPorWhatsapp++;
                }
            }
        }

        return new ResultadoAnuncio(notificaciones.size(), enviadosPorWhatsapp);
    }

    public Page<NotificacionResponse> obtenerNotificaciones(UUID estudianteId, Pageable pageable) {
        return notificacionRepository.findByEstudianteIdOrderByCreatedAtDesc(estudianteId, pageable)
                .map(this::toResponse);
    }

    private NotificacionResponse toResponse(Notificacion n) {
        return new NotificacionResponse(
                n.getId(), n.getTitulo(), n.getMensaje(), n.getTipo(),
                n.getReferenciaId(), n.getMediaUrl(), n.getMediaTipo(), n.isLeida(), n.getCreatedAt());
    }

    public long contarNoLeidas(UUID estudianteId) {
        return notificacionRepository.countByEstudianteIdAndLeidaFalse(estudianteId);
    }

    @Transactional
    public void marcarLeida(UUID id, Authentication auth) {
        var notificacion = notificacionRepository.findById(id)
                .orElseThrow(() -> new com.novacrm.exception.ResourceNotFoundException("Notificacion no encontrada: " + id));
        ownershipService.verificarAccesoEstudiante(auth, notificacion.getEstudiante().getId());
        notificacion.setLeida(true);
        notificacionRepository.save(notificacion);
    }

    @Transactional
    public void marcarTodasLeidas(UUID estudianteId, Authentication auth) {
        ownershipService.verificarAccesoEstudiante(auth, estudianteId);
        var notificaciones = notificacionRepository.findByEstudianteIdAndLeidaFalse(estudianteId);
        for (var n : notificaciones) {
            n.setLeida(true);
        }
        notificacionRepository.saveAll(notificaciones);
    }

    @Transactional
    public void eliminar(UUID id, Authentication auth) {
        var notificacion = notificacionRepository.findById(id)
                .orElseThrow(() -> new com.novacrm.exception.ResourceNotFoundException("Notificacion no encontrada: " + id));
        ownershipService.verificarAccesoEstudiante(auth, notificacion.getEstudiante().getId());
        notificacionRepository.delete(notificacion);
    }

    /**
     * Avisa de los matches nuevos de una corrida, agrupando por estudiante.
     *
     * <p>Antes se emitía una notificación y una plantilla de WhatsApp por cada
     * match. Con ~107 participantes activos y hasta 500 vacantes por corrida
     * eso son decenas de miles de mensajes en una sola ejecución del
     * programador: la bandeja del estudiante queda inservible y la factura de
     * WhatsApp se dispara. Ahora cada estudiante recibe una notificación con su
     * resumen, y por WhatsApp solo van sus mejores {@code TOPE_WHATSAPP}
     * matches —que son los únicos con botones de sí/no, la señal que después
     * sirve para calibrar el motor—.
     */
    @Transactional
    public void generarNotificacionesMatch(List<Match> matches) {
        if (matches == null || matches.isEmpty()) {
            return;
        }
        var porEstudiante = matches.stream()
                .collect(java.util.stream.Collectors.groupingBy(m -> m.getEstudiante().getId()));

        List<Match> avisosWhatsapp = new java.util.ArrayList<>();
        for (var lote : porEstudiante.values()) {
            // De mayor a menor puntaje: lo primero que lee el estudiante y lo
            // que se lleva el cupo de WhatsApp debe ser lo más afín.
            var ordenados = lote.stream()
                    .sorted(java.util.Comparator.comparing(Match::getPuntaje).reversed())
                    .toList();

            notificacionRepository.save(resumenDe(ordenados));
            for (Match match : ordenados) {
                match.setNotificado(true);
            }
            matchRepository.saveAll(ordenados);
            avisosWhatsapp.addAll(ordenados.subList(0, Math.min(TOPE_WHATSAPP, ordenados.size())));
        }

        // El aviso por WhatsApp (si el programa tiene canal) va con la misma
        // decisión: el match ya es notificable, así que también se le avisa al
        // celular con sus botones de sí/no.
        whatsappAvisosService.avisarMatches(avisosWhatsapp);
    }

    /** Cuántos matches de un mismo estudiante llegan a WhatsApp por corrida. */
    static final int TOPE_WHATSAPP = 3;

    /** Cuántos títulos se nombran en el resumen antes de resumir el resto. */
    private static final int TITULOS_EN_RESUMEN = 3;

    private Notificacion resumenDe(List<Match> ordenados) {
        var notificacion = new Notificacion();
        notificacion.setEstudiante(ordenados.get(0).getEstudiante());
        notificacion.setTipo("MATCH");
        // Apunta al mejor: es el único destino con sentido para un resumen, y
        // deja el enlace utilizable cuando el lote trae un solo match.
        notificacion.setReferenciaId(ordenados.get(0).getId().toString());

        if (ordenados.size() == 1) {
            notificacion.setTitulo("Nueva vacante recomendada");
            notificacion.setMensaje("Se ha encontrado una vacante que coincide con tu perfil: "
                    + ordenados.get(0).getVacante().getTitulo());
            return notificacion;
        }

        var titulos = ordenados.stream()
                .limit(TITULOS_EN_RESUMEN)
                .map(m -> m.getVacante().getTitulo())
                .toList();
        int restantes = ordenados.size() - titulos.size();
        String mensaje = "Se encontraron " + ordenados.size()
                + " vacantes que coinciden con tu perfil: " + String.join(", ", titulos)
                + (restantes > 0 ? " y " + restantes + " más." : ".");

        notificacion.setTitulo(ordenados.size() + " vacantes recomendadas");
        notificacion.setMensaje(mensaje);
        return notificacion;
    }

    /**
     * Avisa de que un companero escribio.
     *
     * <p>Sin esto el chat entre estudiantes era de una sola direccion: llegaba
     * el mensaje y el destinatario no se enteraba salvo que buscara a esa
     * persona y abriera la conversacion por su cuenta.
     *
     * <p>Uno por conversacion mientras no se lea, no uno por mensaje. Veinte
     * frases seguidas no son veinte noticias, y llenar la campana con ellas
     * tapa las alertas del programa. Es la misma leccion que ya se aprendio
     * con los avisos de match.
     *
     * @param remitenteId de quien viene, y a la vez la referencia que agrupa
     */
    @Transactional
    public void registrarMensajeDeCompanero(Estudiante destinatario, UUID remitenteId, String nombreRemitente) {
        String referencia = remitenteId.toString();
        if (notificacionRepository.existsByEstudianteIdAndTipoAndReferenciaIdAndLeidaFalse(
                destinatario.getId(), TIPO_CHAT, referencia)) {
            return;
        }
        var notificacion = new Notificacion();
        notificacion.setEstudiante(destinatario);
        notificacion.setTitulo("Mensaje de " + nombreRemitente);
        notificacion.setMensaje("Te escribio por el chat. Abre la conversacion para responderle.");
        notificacion.setTipo(TIPO_CHAT);
        notificacion.setReferenciaId(referencia);
        notificacionRepository.save(notificacion);
    }

    /**
     * Da por leidos los avisos de chat de una conversacion.
     *
     * <p>Lo llama el chat al abrir la conversacion, y no es un adorno: como solo
     * se crea un aviso por contacto mientras haya uno sin leer, el aviso que se
     * queda pendiente para siempre deja de ser un aviso y pasa a ser un tapon.
     * El estudiante ve un numero en la campana que leer el chat no baja, y al
     * mismo tiempo los mensajes siguientes de esa persona ya no avisan de nada.
     */
    @Transactional
    public void marcarLeidosLosAvisosDeChat(UUID estudianteId, UUID contactoId) {
        var pendientes = notificacionRepository
                .findByEstudianteIdAndTipoAndReferenciaIdAndLeidaFalse(
                        estudianteId, TIPO_CHAT, contactoId.toString());
        if (pendientes.isEmpty()) return;
        for (var notificacion : pendientes) {
            notificacion.setLeida(true);
        }
        notificacionRepository.saveAll(pendientes);
    }

    /** Registra en la bandeja del estudiante cada mensaje enviado por el equipo. */
    @Transactional
    public void registrarMensajeDelEquipo(Estudiante estudiante, UUID mensajeId) {
        var notificacion = new Notificacion();
        notificacion.setEstudiante(estudiante);
        notificacion.setTitulo("Nuevo mensaje de CAC Academic");
        notificacion.setMensaje("El equipo de acompañamiento te envió un mensaje. Revísalo en la bandeja de mensajes.");
        notificacion.setTipo("MENSAJE");
        notificacion.setReferenciaId(mensajeId.toString());
        notificacionRepository.save(notificacion);
    }
}
