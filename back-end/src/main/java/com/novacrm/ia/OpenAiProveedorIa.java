package com.novacrm.ia;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Implementación de {@link ProveedorIa} para la API oficial de OpenAI (GPT-4o, GPT-4o-mini, etc.).
 */
@Component
public class OpenAiProveedorIa implements ProveedorIa {

    private static final Logger log = LoggerFactory.getLogger(OpenAiProveedorIa.class);
    private static final String API_BASE = "https://api.openai.com/v1";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final RestClient restClient;
    private final String modelo;
    private final String apiKey;

    @org.springframework.beans.factory.annotation.Autowired
    public OpenAiProveedorIa(@Value("${app.ia.openai.api-key:}") String apiKey,
                             @Value("${app.ia.openai.modelo:gpt-4o-mini}") String modelo) {
        this(apiKey, modelo, API_BASE);
    }

    public OpenAiProveedorIa(String apiKey, String modelo, String apiBase) {
        this.apiKey = apiKey;
        this.modelo = modelo;
        String urlFinal = apiBase != null ? apiBase.trim() : API_BASE;
        if (urlFinal.endsWith("/")) {
            urlFinal = urlFinal.substring(0, urlFinal.length() - 1);
        }
        if (!urlFinal.endsWith("/chat/completions")) {
            urlFinal += "/chat/completions";
        }

        this.restClient = RestClient.builder()
                .baseUrl(urlFinal)
                .defaultHeaders(headers -> {
                    headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey);
                    headers.setContentType(MediaType.APPLICATION_JSON);
                })
                .build();
    }

    @Override
    public String nombre() {
        return "openai";
    }

    @Override
    public boolean disponible() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public Optional<JsonNode> completarJson(String instrucciones, String contenido) {
        if (!disponible()) {
            return Optional.empty();
        }
        try {
            var respuesta = restClient.post()
                    .uri("")
                    .body(Map.of(
                            "model", modelo,
                            "temperature", 0,
                            "response_format", Map.of("type", "json_object"),
                            "messages", List.of(
                                    Map.of("role", "system", "content", instrucciones),
                                    Map.of("role", "user", "content", contenido))))
                    .retrieve()
                    .toEntity(Map.class);

            if (!respuesta.getStatusCode().is2xxSuccessful() || respuesta.getBody() == null) {
                log.warn("OpenAI respondió HTTP {} en consulta", respuesta.getStatusCode());
                return Optional.empty();
            }
            var json = MAPPER.readTree(MAPPER.writeValueAsString(respuesta.getBody()));
            JsonNode textContent = json.path("choices").path(0).path("message").path("content");
            if (textContent.isMissingNode() || textContent.isNull()) {
                return Optional.empty();
            }
            return Optional.of(MAPPER.readTree(textContent.asText()));
        } catch (Exception e) {
            log.warn("Consulta a OpenAI falló: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
