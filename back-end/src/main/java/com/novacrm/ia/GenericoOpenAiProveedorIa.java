package com.novacrm.ia;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Proveedor genérico compatible con cualquier API LLM con formato OpenAI
 * (DeepSeek, Ollama local, OpenRouter, Mistral, Together AI, Azure OpenAI, etc.).
 */
@Component
public class GenericoOpenAiProveedorIa implements ProveedorIa {

    private static final Logger log = LoggerFactory.getLogger(GenericoOpenAiProveedorIa.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final RestClient restClient;
    private final String modelo;
    private final String apiKey;
    private final double temperatura;

    @Autowired
    public GenericoOpenAiProveedorIa(
            @Value("${app.ia.custom.api-key:}") String apiKey,
            @Value("${app.ia.custom.modelo:deepseek-chat}") String modelo,
            @Value("${app.ia.custom.api-base:https://api.deepseek.com/v1}") String apiBase,
            @Value("${app.ia.custom.temperatura:0.0}") double temperatura) {
        this.apiKey = apiKey;
        this.modelo = modelo;
        this.temperatura = temperatura;
        
        String urlFinal = (apiBase != null && !apiBase.isBlank()) ? apiBase.trim() : "https://api.deepseek.com/v1";
        this.restClient = RestClient.builder()
                .baseUrl(urlFinal)
                .defaultHeaders(headers -> {
                    if (apiKey != null && !apiKey.isBlank()) {
                        headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey.trim());
                    }
                    headers.setContentType(MediaType.APPLICATION_JSON);
                })
                .build();
        log.info("GenericoOpenAiProveedorIa inicializado para endpoint '{}' con modelo '{}'", urlFinal, modelo);
    }

    @Override
    public String nombre() {
        return "custom";
    }

    @Override
    public boolean disponible() {
        // En servicios locales como Ollama o LM Studio no se requiere API Key
        return true;
    }

    @Override
    public Optional<JsonNode> completarJson(String instrucciones, String contenido) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("model", modelo);
            body.put("temperature", temperatura);
            body.put("messages", List.of(
                    Map.of("role", "system", "content", instrucciones),
                    Map.of("role", "user", "content", contenido)
            ));

            var respuesta = restClient.post()
                    .uri("/chat/completions")
                    .body(body)
                    .retrieve()
                    .toEntity(Map.class);

            if (!respuesta.getStatusCode().is2xxSuccessful() || respuesta.getBody() == null) {
                log.warn("Proveedor IA personalizado respondió HTTP {}", respuesta.getStatusCode());
                return Optional.empty();
            }

            var json = MAPPER.readTree(MAPPER.writeValueAsString(respuesta.getBody()));
            JsonNode textContent = json.path("choices").path(0).path("message").path("content");
            if (textContent.isMissingNode() || textContent.isNull()) {
                return Optional.empty();
            }

            String rawText = textContent.asText().trim();
            // Limpieza de Markdown codeblocks ```json ... ``` que retornan algunos modelos local/DeepSeek
            if (rawText.startsWith("```json")) {
                rawText = rawText.substring(7);
            } else if (rawText.startsWith("```")) {
                rawText = rawText.substring(3);
            }
            if (rawText.endsWith("```")) {
                rawText = rawText.substring(0, rawText.length() - 3);
            }

            return Optional.of(MAPPER.readTree(rawText.trim()));
        } catch (Exception e) {
            log.warn("Consulta a Proveedor IA Personalizado ({}) falló: {}", modelo, e.getMessage());
            return Optional.empty();
        }
    }
}
