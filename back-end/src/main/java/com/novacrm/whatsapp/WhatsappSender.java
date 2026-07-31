package com.novacrm.whatsapp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Envia mensajes por la WhatsApp Cloud API de Meta.
 *
 * <p>Mismo contrato que {@code EmailService}: el envio nunca rompe el flujo
 * del que llama —siempre devuelve un {@link Resultado} con el motivo del fallo
 * y nunca lanza. Los avisos son un canal más del sistema: si cae, el estudiante
 * sigue viendo la vacante en su bandeja.
 */
@Service
public class WhatsappSender {

    private static final Logger log = LoggerFactory.getLogger(WhatsappSender.class);
    private static final String API_BASE = "https://graph.facebook.com/v21.0";

    private final ProgramaWhatsappRepository whatsappRepository;
    private final RestClient restClient;

    public WhatsappSender(ProgramaWhatsappRepository whatsappRepository) {
        this.whatsappRepository = whatsappRepository;
        this.restClient = RestClient.builder().baseUrl(API_BASE).build();
    }

    /** Resultado de un envio. Idéntico en forma al de EmailService. */
    public record Resultado(boolean enviado, String motivoFallo) {
        public static Resultado ok() {
            return new Resultado(true, null);
        }

        public static Resultado fallo(String motivo) {
            return new Resultado(false, motivo);
        }
    }

    /** Si el programa tiene un canal activo y con token. */
    public boolean estaConfigurado(UUID programaId) {
        return leerCanal(programaId).isPresent();
    }

    /** El canal activo del programa, con el token descifrado solo para enviar. */
    private Optional<ProgramaWhatsapp> leerCanal(UUID programaId) {
        return whatsappRepository.findById(programaId)
                .filter(ProgramaWhatsapp::isActivo)
                .filter(w -> w.getTokenCifrado() != null);
    }

    /**
     * Envia un mensaje de texto. El destino se normaliza aqui: los celulares de
     * la base llegan como los escribio quien los cargo (con espacios, sin +,
     * a veces sin indicativo), y el formato E.164 se exige en la llamada a Meta.
     */
    public Resultado enviarTexto(UUID programaId, String celularDestino, String texto) {
        String destino = normalizarDestino(celularDestino);
        if (destino == null) {
            String motivo = "Celular de destino no valido: " + celularDestino;
            log.warn("No se envio el WhatsApp: {}", motivo);
            return Resultado.fallo(motivo);
        }
        var canal = leerCanal(programaId).orElse(null);
        if (canal == null) {
            return Resultado.fallo("WhatsApp no configurado o inactivo para el programa " + programaId);
        }

        String token = descifrar(canal);
        if (token == null) {
            return Resultado.fallo("No se pudo descifrar el token de WhatsApp del programa " + programaId);
        }

        try {
            var respuesta = restClient.post()
                    .uri("/{phoneId}/messages", canal.getPhoneId())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "messaging_product", "whatsapp",
                            "to", destino,
                            "type", "text",
                            "text", Map.of("body", texto)))
                    .retrieve()
                    .toEntity(Map.class);

            if (respuesta.getStatusCode().is2xxSuccessful()) {
                log.info("WhatsApp enviado a {} (programa {})", destino, programaId);
                return Resultado.ok();
            }
            return Resultado.fallo("Meta respondió " + respuesta.getStatusCode());
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            String motivo = mensajeErrorMeta(e.getResponseBodyAsString());
            log.error("WhatsApp a {} falló (HTTP {}): {}", destino, e.getStatusCode(), motivo);
            return Resultado.fallo(motivo);
        } catch (Exception e) {
            log.error("WhatsApp a {} falló: {}", destino, e.getMessage());
            return Resultado.fallo(e.getMessage());
        }
    }

    /**
     * Envia una plantilla aprobada de Meta. Es el único tipo de mensaje que la
     * API permite para avisos iniciados por el negocio, así que todos los
     * avisos automáticos pasan por aquí.
     *
     * @param nombrePlantilla nombre exacto de la plantilla aprobada (Fase E)
     * @param parametrosCuerpo valores para los {{1}}, {{2}}... del cuerpo
     * @param botones respuesta rápida; cada botón lleva el payload que la API
     *                sustituye por el de la plantilla. Si llega null, la
     *                plantilla se envía sin botones.
     */
    public Resultado enviarPlantilla(UUID programaId, String celularDestino, String nombrePlantilla,
                                     java.util.List<String> parametrosCuerpo,
                                     java.util.List<BotonRapido> botones) {
        String destino = normalizarDestino(celularDestino);
        if (destino == null) {
            return Resultado.fallo("Celular de destino no valido: " + celularDestino);
        }
        var canal = leerCanal(programaId).orElse(null);
        if (canal == null) {
            return Resultado.fallo("WhatsApp no configurado o inactivo para el programa " + programaId);
        }

        String token = descifrar(canal);
        if (token == null) {
            return Resultado.fallo("No se pudo descifrar el token de WhatsApp del programa " + programaId);
        }

        var componentes = new java.util.ArrayList<Object>();
        if (parametrosCuerpo != null && !parametrosCuerpo.isEmpty()) {
            componentes.add(Map.of(
                    "type", "body",
                    "parameters", parametrosCuerpo.stream()
                            .map(p -> (Object) Map.of("type", "text", "text", p))
                            .toList()));
        }
        if (botones != null) {
            for (int i = 0; i < botones.size(); i++) {
                String payload = botones.get(i).payload();
                componentes.add(Map.of(
                        "type", "button",
                        "sub_type", "quick_reply",
                        "index", String.valueOf(i),
                        "parameters", java.util.List.of(Map.of(
                                "type", "payload",
                                "payload", payload))));
            }
        }

        try {
            var respuesta = restClient.post()
                    .uri("/{phoneId}/messages", canal.getPhoneId())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "messaging_product", "whatsapp",
                            "to", destino,
                            "type", "template",
                            "template", Map.of(
                                    "name", nombrePlantilla,
                                    "language", Map.of("code", "es"),
                                    "components", componentes)))
                    .retrieve()
                    .toEntity(Map.class);

            if (respuesta.getStatusCode().is2xxSuccessful()) {
                log.info("Plantilla {} enviada a {} (programa {})", nombrePlantilla, destino, programaId);
                return Resultado.ok();
            }
            return Resultado.fallo("Meta respondió " + respuesta.getStatusCode());
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            String motivo = mensajeErrorMeta(e.getResponseBodyAsString());
            log.error("Plantilla {} a {} falló (HTTP {}): {}", nombrePlantilla, destino,
                    e.getStatusCode(), motivo);
            return Resultado.fallo(motivo);
        } catch (Exception e) {
            log.error("Plantilla {} a {} falló: {}", nombrePlantilla, destino, e.getMessage());
            return Resultado.fallo(e.getMessage());
        }
    }

    /** Botón de respuesta rápida de una plantilla. */
    public record BotonRapido(String payload, String texto) {}

    /**
     * Normaliza un celular escrito por una persona a E.164: quita separadores
     * y añade el indicativo de Colombia (+57) a un número local de 10 dígitos.
     *
     * <p>ponytail: asume Colombia, que es donde opera Nova; para otro país
     * habría que parametrizar el indicativo. Un número que no encaja en
     * ninguno de los dos formatos devuelve null y el envío falla con motivo.
     */
    static String normalizarDestino(String celular) {
        if (celular == null) return null;
        String digitos = celular.replaceAll("[\\s()\\-.]", "");
        if (digitos.startsWith("+")) {
            digitos = digitos.substring(1);
        }
        if (digitos.matches("\\d{10}") && digitos.startsWith("3")) {
            digitos = "57" + digitos;
        }
        return digitos.matches("\\+?[1-9][0-9]{7,14}") ? "+" + digitos.replace("+", "") : null;
    }

    /** El canal del programa, con token descifrado, o null si no usable. */
    public Canal activo(UUID programaId) {
        var canal = leerCanal(programaId).orElse(null);
        if (canal == null) {
            return null;
        }
        String token = descifrar(canal);
        return token == null ? null : new Canal(canal.getPhoneId(), token);
    }

    public record Canal(String phoneId, String token) {}

    private String descifrar(ProgramaWhatsapp canal) {
        try {
            return WhatsappCrypto.descifrar(canal.getTokenCifrado());
        } catch (Exception e) {
            log.error("No se pudo descifrar el token de WhatsApp del programa {}: {}",
                    canal.getProgramaId(), e.getMessage());
            return null;
        }
    }

    private static final com.fasterxml.jackson.databind.ObjectMapper MAPPER =
            new com.fasterxml.jackson.databind.ObjectMapper();

    /** Extrae el mensaje legible del cuerpo de error de Meta. */
    static String mensajeErrorMeta(String cuerpo) {
        try {
            var json = MAPPER.readTree(cuerpo);
            var mensaje = json.path("error").path("message").asText(null);
            return mensaje != null ? mensaje : cuerpo;
        } catch (Exception e) {
            return cuerpo;
        }
    }
}
