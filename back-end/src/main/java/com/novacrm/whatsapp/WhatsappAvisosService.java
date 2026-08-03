package com.novacrm.whatsapp;

import com.novacrm.estudiante.Estudiante;
import com.novacrm.matching.Match;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Avisos automáticos por WhatsApp.
 *
 * <p>Cada aviso exige la plantilla aprobada correspondiente en Meta; los
 * nombres son fijos por convención ({@value #PLANTILLA_MATCH} etc.) y se crean
 * en el panel de Meta del cliente. Hasta que la plantilla exista, el envío
 * falla silenciosamente —el aviso por la bandeja interna del panel sigue
 * cubriendo al estudiante, igual que antes—.
 *
 * <p>Regla de oro heredada de {@code EmailService}: un fallo de WhatsApp
 * nunca rompe el flujo que lo dispara.
 */
@Service
public class WhatsappAvisosService {

    private static final Logger log = LoggerFactory.getLogger(WhatsappAvisosService.class);

    /** Aviso de vacante recomendada, con botones de sí/no. */
    public static final String PLANTILLA_MATCH = "nova_match";
    /** Enlace de activación de cuenta. */
    public static final String PLANTILLA_CUENTA = "nova_cuenta";
    /** Anuncio del coordinador. */
    public static final String PLANTILLA_ANUNCIO = "nova_anuncio";

    private final WhatsappSender whatsappSender;
    private final MensajeWhatsappRepository mensajesRepository;
    private final ProgramaWhatsappRepository whatsappRepository;

    public WhatsappAvisosService(WhatsappSender whatsappSender,
                                 MensajeWhatsappRepository mensajesRepository,
                                 ProgramaWhatsappRepository whatsappRepository) {
        this.whatsappSender = whatsappSender;
        this.mensajesRepository = mensajesRepository;
        this.whatsappRepository = whatsappRepository;
    }

    /**
     * Avisa a cada estudiante de sus matches nuevos. Se llama desde
     * {@code NotificacionService.generarNotificacionesMatch}, que es donde el
     * sistema ya decidió que el match es notificable.
     */
    @Transactional
    public void avisarMatches(List<Match> matches) {
        for (Match match : matches) {
            var estudiante = match.getEstudiante();
            UUID programaId = programaDe(estudiante);
            if (programaId == null) continue;

            var vacante = match.getVacante();
            String empresa = vacante.getEmpresa() != null ? vacante.getEmpresa().getNombre() : "empresa sin registrar";
            String textoRegistro = "Nueva vacante: " + vacante.getTitulo()
                    + " en " + empresa + " (afinidad " + match.getPuntaje() + "%).";

            var resultado = whatsappSender.enviarPlantilla(programaId, estudiante.getCelular(),
                    PLANTILLA_MATCH,
                    List.of(vacante.getTitulo(), empresa, String.valueOf(match.getPuntaje())),
                    List.of(
                            new WhatsappSender.BotonRapido("match:" + match.getId(), "Sí me interesa"),
                            new WhatsappSender.BotonRapido("no:" + match.getId(), "No, gracias")));

            if (resultado.enviado()) {
                registrarSaliente(estudiante, textoRegistro);
            } else {
                log.info("Aviso de match a {} no enviado: {}", estudiante.getEmail(), resultado.motivoFallo());
            }
        }
    }

    /** Aviso de activación de cuenta, junto al correo que ya se envía. */
    @Transactional
    public void avisarActivacion(Estudiante estudiante, String nombre, String enlace) {
        UUID programaId = programaDe(estudiante);
        if (programaId == null) return;
        if (!whatsappSender.estaConfigurado(programaId)) return;

        var resultado = whatsappSender.enviarPlantilla(programaId, estudiante.getCelular(),
                PLANTILLA_CUENTA, List.of(nombre, enlace), null);
        if (resultado.enviado()) {
            registrarSaliente(estudiante, "Enlace de activación enviado a " + nombre + ".");
        } else {
            log.info("Aviso de activación a {} no enviado: {}", estudiante.getEmail(), resultado.motivoFallo());
        }
    }

    /** Aviso de anuncio, cuando el coordinador lo pidió al publicarlo. */
    @Transactional
    public void avisarAnuncio(Estudiante estudiante, String titulo, String mensaje) {
        UUID programaId = programaDe(estudiante);
        if (programaId == null) return;
        if (!whatsappSender.estaConfigurado(programaId)) return;

        var resultado = whatsappSender.enviarPlantilla(programaId, estudiante.getCelular(),
                PLANTILLA_ANUNCIO, List.of(titulo, mensaje), null);
        if (resultado.enviado()) {
            registrarSaliente(estudiante, titulo + ": " + mensaje);
        } else {
            log.info("Aviso de anuncio a {} no enviado: {}", estudiante.getEmail(), resultado.motivoFallo());
        }
    }

    private void registrarSaliente(Estudiante estudiante, String texto) {
        var mensaje = new MensajeWhatsapp();
        mensaje.setEstudiante(estudiante);
        mensaje.setPrograma(estudiante.getPrograma());
        mensaje.setRemitente(numeroDelCanal(estudiante));
        mensaje.setTipo(MensajeWhatsapp.Tipo.SALIENTE);
        mensaje.setTexto(texto);
        mensajesRepository.save(mensaje);
    }

    private String numeroDelCanal(Estudiante estudiante) {
        if (estudiante.getPrograma() == null) return null;
        return whatsappRepository.findById(estudiante.getPrograma().getId())
                .map(ProgramaWhatsapp::getNumeroWhatsapp)
                .orElse(null);
    }

    private static UUID programaDe(Estudiante estudiante) {
        return estudiante.getPrograma() == null ? null : estudiante.getPrograma().getId();
    }
}
