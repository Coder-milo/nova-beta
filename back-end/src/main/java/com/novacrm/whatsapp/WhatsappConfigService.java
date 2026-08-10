package com.novacrm.whatsapp;

import com.novacrm.auth.OwnershipService;
import com.novacrm.exception.BusinessException;
import com.novacrm.exception.ResourceNotFoundException;
import com.novacrm.programa.ProgramaRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Lee y guarda el canal de WhatsApp de cada programa.
 *
 * <p>La regla de aislamiento es la misma que en el branding: quien consulta
 * (un estudiante) solo puede ver el canal de su propio programa. El token de
 * acceso se cifra en el guardado y no vuelve a salir nunca de la base.
 */
@Service
public class WhatsappConfigService {

    /** El mismo formato que exige la restriccion de la tabla. */
    private static final Pattern E164 = Pattern.compile("^\\+[1-9][0-9]{7,14}$");

    private final ProgramaWhatsappRepository whatsappRepository;
    private final MensajeWhatsappRepository mensajesRepository;
    private final ProgramaRepository programaRepository;
    private final OwnershipService ownershipService;

    public WhatsappConfigService(ProgramaWhatsappRepository whatsappRepository,
                                 MensajeWhatsappRepository mensajesRepository,
                                 ProgramaRepository programaRepository,
                                 OwnershipService ownershipService) {
        this.whatsappRepository = whatsappRepository;
        this.mensajesRepository = mensajesRepository;
        this.programaRepository = programaRepository;
        this.ownershipService = ownershipService;
    }

    /** El canal de un programa, comprobando antes que quien pregunta puede verlo. */
    @Transactional(readOnly = true)
    public WhatsappResponse consultar(Authentication auth, UUID programaId) {
        ownershipService.verificarAccesoPrograma(auth, programaId);
        return leer(programaId);
    }

    /**
     * El canal del programa del propio estudiante, sin que tenga que saber su
     * id y sin la configuracion de la integracion.
     *
     * <p>Devuelve {@link CanalDeSoporteResponse} y no la ficha completa: al
     * portal le hace falta el numero al que escribir, no el identificador de
     * telefono de Meta ni si hay token guardado.
     */
    @Transactional(readOnly = true)
    public CanalDeSoporteResponse consultarElMio(Authentication auth) {
        return CanalDeSoporteResponse.de(
                leer(ownershipService.programaDelEstudianteAutenticado(auth)));
    }

    /** La conversación del programa, de más nueva a más vieja. */
    @Transactional(readOnly = true)
    public List<WhatsappWebhookController.MensajeResponse> bandeja(Authentication auth, UUID programaId) {
        ownershipService.verificarAccesoPrograma(auth, programaId);
        return mensajesRepository.findByProgramaIdOrderByCreatedAtDesc(programaId).stream()
                .map(m -> new WhatsappWebhookController.MensajeResponse(
                        m.getId(),
                        m.getTipo().name(),
                        m.getRemitente(),
                        m.getTexto(),
                        m.getEstudiante() == null ? null : m.getEstudiante().getNombre(),
                        m.getCreatedAt()))
                .toList();
    }

    /** Lectura sin comprobación de acceso, para flujos internos (envío de prueba). */
    @Transactional(readOnly = true)
    public WhatsappResponse leer(UUID programaId) {        var programa = programaRepository.findById(programaId)
                .orElseThrow(() -> new ResourceNotFoundException("Programa no encontrado"));
        return whatsappRepository.findById(programaId)
                .map(w -> WhatsappResponse.de(programa.getNombre(), w))
                .orElseGet(() -> WhatsappResponse.vacio(programaId, programa.getNombre()));
    }

    /**
     * Guarda el canal. Solo ADMIN o COORDINADOR llegan aqui; lo garantiza la
     * regla de URL y el {@code @PreAuthorize} del controlador.
     */
    @Transactional
    public WhatsappResponse guardar(UUID programaId, WhatsappRequest request) {
        var programa = programaRepository.findById(programaId)
                .orElseThrow(() -> new ResourceNotFoundException("Programa no encontrado"));

        String numero = normalizarNumero(request.numeroWhatsapp());
        String phoneId = vacioComoNulo(request.phoneId());

        var canal = whatsappRepository.findById(programaId)
                .orElseGet(() -> new ProgramaWhatsapp(programaId));

        String tokenPrevio = canal.getTokenCifrado();
        String tokenNuevo = vacioComoNulo(request.token());
        if (tokenNuevo != null) {
            canal.setTokenCifrado(WhatsappCrypto.cifrar(tokenNuevo));
        } else {
            canal.setTokenCifrado(tokenPrevio);
        }

        boolean activo = request.activo() != null && request.activo();
        boolean hayToken = canal.getTokenCifrado() != null;

        validar(numero, phoneId, hayToken, activo);

        canal.setNumeroWhatsapp(numero);
        canal.setPhoneId(phoneId);
        canal.setActivo(activo);
        canal.tocar();
        whatsappRepository.save(canal);

        return WhatsappResponse.de(programa.getNombre(), canal);
    }

    private void validar(String numero, String phoneId, boolean hayToken, boolean activo) {
        if (numero != null && !E164.matcher(numero).matches()) {
            throw new BusinessException("El numero debe ir en formato internacional E.164 "
                    + "(ej. +573001234567); llego: " + numero);
        }
        if (hayToken && (numero == null || phoneId == null)) {
            throw new BusinessException("El canal necesita numero de negocio y phone_id para poder enviar");
        }
        if (activo && !hayToken) {
            throw new BusinessException(
                    "Para activar el canal primero hay que guardar el token de acceso de Meta");
        }
    }

    /**
     * Normaliza lo que escribe una persona: quita espacios, guiones y
     * parentesis, de modo que +57 300 123 4567 y +573001234567 guarden igual.
     */
    static String normalizarNumero(String numero) {
        String limpio = vacioComoNulo(numero);
        return limpio == null ? null : limpio.replaceAll("[\\s()\\-.]", "");
    }

    private static String vacioComoNulo(String valor) {
        if (valor == null) return null;
        String limpio = valor.trim();
        return limpio.isEmpty() ? null : limpio;
    }
}
