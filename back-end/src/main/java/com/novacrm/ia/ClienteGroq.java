package com.novacrm.ia;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.HttpStatusCodeException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Llamadas a la API de Groq (modelos abiertos, tier gratuito).
 */
@Component
public class ClienteGroq implements ProveedorIa {

    private static final Logger log = LoggerFactory.getLogger(ClienteGroq.class);
    private static final String API_BASE = "https://api.groq.com/openai/v1";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final RestClient restClient;
    private final String modelo;
    private final String apiKey;
    private final long retryEsperaMs;

    @org.springframework.beans.factory.annotation.Autowired
    public ClienteGroq(@Value("${app.ia.groq.api-key:}") String apiKey,
                       @Value("${app.ia.groq.modelo:llama-3.3-70b-versatile}") String modelo,
                       @Value("${app.ia.groq.timeout-ms:10000}") int timeoutMs) {
        this(apiKey, modelo, timeoutMs, API_BASE);
    }

    /** Para tests: apunta el cliente a un servidor local. */
    public ClienteGroq(String apiKey, String modelo, int timeoutMs, String apiBase) {
        this(apiKey, modelo, timeoutMs, apiBase, 2000);
    }

    /** Constructor completo, incluida la espera del reintento tras un 429. */
    public ClienteGroq(String apiKey, String modelo, int timeoutMs, String apiBase, long retryEsperaMs) {
        this.apiKey = apiKey;
        this.modelo = modelo;
        this.retryEsperaMs = retryEsperaMs;

        String urlFinal = (apiBase != null && !apiBase.isBlank()) ? apiBase.trim() : API_BASE;
        if (urlFinal.endsWith("/")) {
            urlFinal = urlFinal.substring(0, urlFinal.length() - 1);
        }
        if (!urlFinal.endsWith("/chat/completions")) {
            urlFinal += "/chat/completions";
        }

        var peticiones = new SimpleClientHttpRequestFactory();
        peticiones.setConnectTimeout(timeoutMs);
        peticiones.setReadTimeout(timeoutMs);

        this.restClient = RestClient.builder()
                .baseUrl(urlFinal)
                .requestFactory(peticiones)
                .defaultHeaders(headers -> {
                    if (apiKey != null && !apiKey.isBlank()) {
                        headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey.trim());
                    }
                    headers.setContentType(MediaType.APPLICATION_JSON);
                })
                .build();

        if (disponible()) {
            log.info("ClienteGroq inicializado correctamente con modelo {} en {}", modelo, urlFinal);
        } else {
            log.info("ClienteGroq inicializado sin API key (IA desactivada/fallback)");
        }
    }

    @Override
    public String nombre() {
        return "groq";
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
                log.warn("Groq respondió {} en una consulta de reconocimiento", respuesta.getStatusCode());
                return Optional.empty();
            }
            return extraerContenido(respuesta.getBody());
        } catch (HttpStatusCodeException e) {
            if (e.getStatusCode().value() == 429) {
                return reintentar(instrucciones, contenido);
            }
            log.warn("Groq respondió {} en una consulta de reconocimiento", e.getStatusCode());
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Consulta a Groq falló: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private Optional<JsonNode> reintentar(String instrucciones, String contenido) {
        try {
            Thread.sleep(retryEsperaMs);
            log.warn("Groq respondió 429, reintento tras {}ms", retryEsperaMs);
            var reintento = restClient.post()
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
            if (reintento.getStatusCode().is2xxSuccessful() && reintento.getBody() != null) {
                return extraerContenido(reintento.getBody());
            }
        } catch (InterruptedException interrumpido) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (Exception otra) {
            log.warn("Reintento a Groq tras 429 falló: {}", otra.getMessage());
        }
        return Optional.empty();
    }

    private Optional<JsonNode> extraerContenido(Map<?, ?> cuerpo) {
        try {
            var json = MAPPER.readTree(MAPPER.writeValueAsString(cuerpo));
            JsonNode contenido = json.path("choices").path(0).path("message").path("content");
            if (contenido.isMissingNode() || contenido.isNull()) {
                return Optional.empty();
            }
            String raw = contenido.asText().trim();
            if (raw.startsWith("```json")) {
                raw = raw.substring(7);
            } else if (raw.startsWith("```")) {
                raw = raw.substring(3);
            }
            if (raw.endsWith("```")) {
                raw = raw.substring(0, raw.length() - 3);
            }
            return Optional.of(MAPPER.readTree(raw.trim()));
        } catch (Exception e) {
            log.warn("Respuesta de Groq ilegible: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
