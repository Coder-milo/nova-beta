package com.novacrm.whatsapp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Implementación de {@link ProveedorWhatsapp} basada en la WhatsApp Cloud API de Meta.
 */
@Component
public class MetaCloudWhatsappProveedor implements ProveedorWhatsapp {

    private static final Logger log = LoggerFactory.getLogger(MetaCloudWhatsappProveedor.class);
    private static final String API_BASE = "https://graph.facebook.com/v21.0";
    private static final com.fasterxml.jackson.databind.ObjectMapper MAPPER = new com.fasterxml.jackson.databind.ObjectMapper();

    private final ProgramaWhatsappRepository whatsappRepository;
    private final RestClient restClient;

    public MetaCloudWhatsappProveedor(ProgramaWhatsappRepository whatsappRepository) {
        this.whatsappRepository = whatsappRepository;
        this.restClient = RestClient.builder().baseUrl(API_BASE).build();
    }

    @Override
    public String nombre() {
        return "meta";
    }

    @Override
    public boolean estaConfigurado(UUID programaId) {
        return leerCanal(programaId).isPresent();
    }

    @Override
    public WhatsappSender.Canal activo(UUID programaId) {
        var canal = leerCanal(programaId).orElse(null);
        if (canal == null) return null;
        String token = descifrar(canal);
        return token == null ? null : new WhatsappSender.Canal(canal.getPhoneId(), token);
    }

    private Optional<ProgramaWhatsapp> leerCanal(UUID programaId) {
        return whatsappRepository.findById(programaId)
                .filter(ProgramaWhatsapp::isActivo)
                .filter(w -> w.getTokenCifrado() != null);
    }

    @Override
    public WhatsappSender.Resultado enviarTexto(UUID programaId, String celularDestino, String texto) {
        String destino = WhatsappSender.normalizarDestino(celularDestino);
        if (destino == null) {
            String motivo = "Celular de destino no valido: " + celularDestino;
            log.warn("No se envio el WhatsApp: {}", motivo);
            return WhatsappSender.Resultado.fallo(motivo);
        }
        var canal = leerCanal(programaId).orElse(null);
        if (canal == null) {
            return WhatsappSender.Resultado.fallo("WhatsApp no configurado o inactivo para el programa " + programaId);
        }

        String token = descifrar(canal);
        if (token == null) {
            return WhatsappSender.Resultado.fallo("No se pudo descifrar el token de WhatsApp del programa " + programaId);
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
                return WhatsappSender.Resultado.ok();
            }
            return WhatsappSender.Resultado.fallo("Meta respondió " + respuesta.getStatusCode());
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            String motivo = mensajeErrorMeta(e.getResponseBodyAsString());
            log.error("WhatsApp a {} falló (HTTP {}): {}", destino, e.getStatusCode(), motivo);
            return WhatsappSender.Resultado.fallo(motivo);
        } catch (Exception e) {
            log.error("WhatsApp a {} falló: {}", destino, e.getMessage());
            return WhatsappSender.Resultado.fallo(e.getMessage());
        }
    }

    @Override
    public WhatsappSender.Resultado enviarPlantilla(UUID programaId, String celularDestino, String nombrePlantilla,
                                                     List<String> parametrosCuerpo,
                                                     List<WhatsappSender.BotonRapido> botones) {
        String destino = WhatsappSender.normalizarDestino(celularDestino);
        if (destino == null) {
            return WhatsappSender.Resultado.fallo("Celular de destino no valido: " + celularDestino);
        }
        var canal = leerCanal(programaId).orElse(null);
        if (canal == null) {
            return WhatsappSender.Resultado.fallo("WhatsApp no configurado o inactivo para el programa " + programaId);
        }

        String token = descifrar(canal);
        if (token == null) {
            return WhatsappSender.Resultado.fallo("No se pudo descifrar el token de WhatsApp del programa " + programaId);
        }

        var componentes = new ArrayList<Object>();
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
                        "parameters", List.of(Map.of(
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
                return WhatsappSender.Resultado.ok();
            }
            return WhatsappSender.Resultado.fallo("Meta respondió " + respuesta.getStatusCode());
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            String motivo = mensajeErrorMeta(e.getResponseBodyAsString());
            log.error("Plantilla {} a {} falló (HTTP {}): {}", nombrePlantilla, destino, e.getStatusCode(), motivo);
            return WhatsappSender.Resultado.fallo(motivo);
        } catch (Exception e) {
            log.error("Plantilla {} a {} falló: {}", nombrePlantilla, destino, e.getMessage());
            return WhatsappSender.Resultado.fallo(e.getMessage());
        }
    }

    private String descifrar(ProgramaWhatsapp canal) {
        try {
            return WhatsappCrypto.descifrar(canal.getTokenCifrado());
        } catch (Exception e) {
            log.error("No se pudo descifrar el token de WhatsApp del programa {}: {}", canal.getProgramaId(), e.getMessage());
            return null;
        }
    }

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
