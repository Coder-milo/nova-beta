package com.novacrm.whatsapp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.estudiante.Estudiante;
import com.novacrm.estudiante.EstudianteRepository;
import com.novacrm.matching.MatchRepository;
import com.novacrm.matching.MatchingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Webhook de la WhatsApp Cloud API.
 *
 * <p>Meta no tiene sesión de Nova: su autenticación es la firma
 * {@code X-Hub-Signature-256}, un HMAC-SHA256 del cuerpo con el APP_SECRET del
 * negocio. Sin firma válida no se procesa nada —que cualquiera pudiera escribir
 * "sí me interesa" en nombre de un estudiante es una postulación falsa en el
 * tablero—.
 *
 * <p>El emparejamiento de remitente con estudiante es por celular: los botones
 * de la plantilla traen el id del match exacto, y un texto libre cae al match
 * sin postular más reciente (ponytail: la heurística es correcta para el caso
 * habitual de un pendiente; con varios, el estudiante responde al último aviso).
 */
@Service
public class WhatsappWebhookService {

    private static final Logger log = LoggerFactory.getLogger(WhatsappWebhookService.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern SI_ME_INTERESA = Pattern.compile(
            "^(s[ií]|me interesa|la quiero|post[uú]lame|s[ií] me interesa).*$",
            Pattern.CASE_INSENSITIVE);

    private final EstudianteRepository estudianteRepository;
    private final MatchRepository matchRepository;
    private final MatchingService matchingService;
    private final WhatsappSender whatsappSender;
    private final MensajeWhatsappRepository mensajesRepository;

    public WhatsappWebhookService(EstudianteRepository estudianteRepository,
                                  MatchRepository matchRepository,
                                  MatchingService matchingService,
                                  WhatsappSender whatsappSender,
                                  MensajeWhatsappRepository mensajesRepository) {
        this.estudianteRepository = estudianteRepository;
        this.matchRepository = matchRepository;
        this.matchingService = matchingService;
        this.whatsappSender = whatsappSender;
        this.mensajesRepository = mensajesRepository;
    }

    /**
     * Mano derecha de la verificación de Meta: devuelve el challenge si el
     * token de verificación coincide con la variable de entorno, o null si no.
     */
    public String verificarSuscripcion(String mode, String verifyToken, String challenge) {
        if (!tokenDeVerificacionValido(mode, verifyToken, System.getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN"))) {
            log.warn("Verificacion de webhook rechazada (mode={})", mode);
            return null;
        }
        return challenge;
    }

    /**
     * Si el token que manda Meta es el que esta configurado.
     *
     * <p>El token esperado se comprueba con {@code isBlank} y no solo con
     * {@code null}: con la variable definida y vacia, lo esperado era la cadena
     * vacia, y cualquiera que mandara {@code hub.verify_token=} pasaba la
     * verificacion. Es la misma comprobacion que ya hacian
     * {@code WHATSAPP_APP_SECRET} y {@code WHATSAPP_TOKEN_KEY}; esta se habia
     * quedado atras.
     *
     * <p>Recibe el token esperado como argumento, igual que {@link #validarFirma},
     * para que se pueda probar sin tocar el entorno del proceso.
     */
    static boolean tokenDeVerificacionValido(String mode, String verifyToken, String esperado) {
        if (!"subscribe".equals(mode) || verifyToken == null
                || esperado == null || esperado.isBlank()) {
            return false;
        }
        return MessageDigest.isEqual(
                verifyToken.getBytes(StandardCharsets.UTF_8),
                esperado.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Procesa un evento de Meta. No responde nada que el estudiante no haya
     * pedido: un botón de la plantilla o un texto libre dentro de la ventana
     * de 24 horas que abre su mensaje.
     */
    @Transactional
    public void procesar(String bodyJson, String firma) {
        String appSecret = System.getenv("WHATSAPP_APP_SECRET");
        if (appSecret == null || appSecret.isBlank()) {
            log.warn("WHATSAPP_APP_SECRET no definida; webhook ignorado");
            throw new AccessDeniedException("WHATSAPP_APP_SECRET no configurada");
        }
        if (!validarFirma(bodyJson, firma, appSecret)) {
            log.warn("Firma de webhook inválida");
            throw new AccessDeniedException("Firma de webhook inválida");
        }

        var mensajes = parsear(bodyJson);
        for (var mensaje : mensajes) {
            procesarMensaje(mensaje);
        }
    }

    private void procesarMensaje(MensajeEntrante entrante) {
        var estudiante = buscarPorCelular(entrante.celular());
        if (estudiante.isEmpty()) {
            log.info("WhatsApp de remitente desconocido ignorado: {}", entrante.celular());
            return;
        }
        var e = estudiante.get();
        if (e.getPrograma() == null) {
            log.info("WhatsApp de estudiante sin programa ignorado: {}", e.getEmail());
            return;
        }
        UUID programaId = e.getPrograma().getId();

        if (entrante.payload() != null) {
            atenderBoton(programaId, e, entrante);
        } else if (SI_ME_INTERESA.matcher(entrante.texto().trim()).matches()) {
            atenderInteresTexto(programaId, e);
        } else {
            registrarBandeja(programaId, e, entrante.celular(), entrante.texto());
            whatsappSender.enviarTexto(programaId, entrante.celular(),
                    "Gracias por tu mensaje. El equipo de acompañamiento te responderá pronto.");
        }
    }

    private void atenderBoton(UUID programaId, Estudiante e, MensajeEntrante entrante) {
        // "match:<uuid>" o "no:<uuid>"
        var partes = entrante.payload().split(":", 2);
        UUID matchId = partes.length == 2 ? uuidDe(partes[1]) : null;
        if (matchId == null) {
            registrarBandeja(programaId, e, entrante.celular(), entrante.texto());
            return;
        }

        if (partes[0].equals("match")) {
            try {
                matchingService.marcarPostulado(matchId, "WhatsApp", true);
                registrarBandeja(programaId, e, entrante.celular(),
                        "Sí me interesa (botón) — postulación registrada");
                whatsappSender.enviarTexto(programaId, entrante.celular(),
                        "¡Listo! Quedó registrada tu postulación. El equipo te contactará con los siguientes pasos.");
            } catch (com.novacrm.exception.BusinessException ex) {
                registrarBandeja(programaId, e, entrante.celular(),
                        "Sí me interesa (botón) — " + ex.getMessage());
                whatsappSender.enviarTexto(programaId, entrante.celular(),
                        "Ya tenías una postulación registrada para esa vacante. ¡Buen trabajo!");
            }
        } else {
            matchingService.descartarMatch(matchId, "WhatsApp");
            registrarBandeja(programaId, e, entrante.celular(), "No, gracias (botón)");
            whatsappSender.enviarTexto(programaId, entrante.celular(),
                    "Entendido. Te avisaremos cuando aparezca otra vacante que encaje contigo.");
        }
    }

    private void atenderInteresTexto(UUID programaId, Estudiante e) {
        var match = matchRepository
                .findFirstByEstudianteIdAndPostuladoFalseOrderByCreatedAtDesc(e.getId())
                .orElse(null);
        if (match == null) {
            whatsappSender.enviarTexto(programaId, e.getCelular(),
                    "No hay vacantes pendientes por confirmar. Cuando aparezca una, te la avisamos.");
            return;
        }
        try {
            matchingService.marcarPostulado(match.getId(), "WhatsApp", true);
            registrarBandeja(programaId, e, e.getCelular(),
                    "Sí me interesa — postulación registrada a " + match.getVacante().getTitulo());
            whatsappSender.enviarTexto(programaId, e.getCelular(),
                    "¡Listo! Quedó registrada tu postulación a " + match.getVacante().getTitulo()
                            + ". El equipo te contactará con los siguientes pasos.");
        } catch (com.novacrm.exception.BusinessException ex) {
            whatsappSender.enviarTexto(programaId, e.getCelular(),
                    "Ya tenías una postulación registrada para esa vacante. ¡Buen trabajo!");
        }
    }

    private void registrarBandeja(UUID programaId, Estudiante e, String celular, String texto) {
        var mensaje = new MensajeWhatsapp();
        mensaje.setPrograma(e.getPrograma());
        mensaje.setEstudiante(e);
        mensaje.setRemitente(celular);
        mensaje.setTipo(MensajeWhatsapp.Tipo.ENTRANTE);
        mensaje.setTexto(texto);
        mensajesRepository.save(mensaje);
    }

    /**
     * El remitente llega en E.164 (573001234567); la base puede guardarlo con
     * 10 dígitos (3001234567). Primero la forma exacta, luego sin el 57.
     */
    private Optional<Estudiante> buscarPorCelular(String celular) {
        String digitos = celular.replaceAll("\\D", "");
        if (digitos.isEmpty()) {
            return Optional.empty();
        }
        var directo = estudianteRepository.findByCelularLimpio(digitos);
        if (directo.isPresent()) {
            return directo;
        }
        if (digitos.length() == 12 && digitos.startsWith("57")) {
            return estudianteRepository.findByCelularLimpio(digitos.substring(2));
        }
        return Optional.empty();
    }

    private static UUID uuidDe(String texto) {
        try {
            return UUID.fromString(texto);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * X-Hub-Signature-256: "sha256=" + hex(HMAC-SHA256(cuerpo, APP_SECRET)).
     */
    static boolean validarFirma(String cuerpo, String firma, String appSecret) {
        if (cuerpo == null || firma == null || !firma.startsWith("sha256=")) {
            return false;
        }
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String esperada = toHex(mac.doFinal(cuerpo.getBytes(StandardCharsets.UTF_8)));
            return MessageDigest.isEqual(
                    esperada.getBytes(StandardCharsets.UTF_8),
                    firma.substring("sha256=".length()).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            return false;
        }
    }

    private static String toHex(byte[] bytes) {
        var sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16));
            sb.append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }

    /** Los mensajes de texto y de botón del evento, sin las capas de Meta. */
    static List<MensajeEntrante> parsear(String bodyJson) {
        var result = new ArrayList<MensajeEntrante>();
        try {
            JsonNode raiz = JSON.readTree(bodyJson);
            for (JsonNode entrada : raiz.path("entry")) {
                for (JsonNode cambio : entrada.path("changes")) {
                    JsonNode mensajes = cambio.path("value").path("messages");
                    for (JsonNode m : mensajes) {
                        String celular = m.path("from").asText(null);
                        if (celular == null) continue;

                        JsonNode boton = m.path("interactive").path("button_reply");
                        if (!boton.isMissingNode()) {
                            result.add(new MensajeEntrante(celular,
                                    boton.path("title").asText(""),
                                    boton.path("id").asText(null)));
                            continue;
                        }
                        String texto = m.path("text").path("body").asText(null);
                        if (texto != null) {
                            result.add(new MensajeEntrante(celular, texto, null));
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Evento de webhook ilegible: {}", e.getMessage());
        }
        return result;
    }

    /** Un mensaje entrante ya desnudo de las capas de Meta. */
    public record MensajeEntrante(String celular, String texto, String payload) {}
}
