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
 * Llamadas a la API de Groq (modelos abiertos, tier gratuito).
 *
 * <p>Mismo contrato que el resto de integraciones externas: nunca lanza y
 * siempre devuelve {@link Optional} — sin clave configurada, con un 429 del
 * tier gratuito o con un cuerpo ilegible, el llamador sigue con su lógica de
 * siempre. La IA es un refuerzo, no una dependencia.
 */
@Component
public class ClienteGroq implements ProveedorIa {

    private static final Logger log = LoggerFactory.getLogger(ClienteGroq.class);
    private static final String API_BASE = "https://api.groq.com/openai/v1";

    private final RestClient restClient;
    private final String modelo;
    private final String apiKey;

    @org.springframework.beans.factory.annotation.Autowired
    public ClienteGroq(@Value("${app.ia.groq.api-key:}") String apiKey,
                       @Value("${app.ia.groq.modelo:llama-3.3-70b-versatile}") String modelo,
                       @Value("${app.ia.groq.timeout-ms:10000}") int timeoutMs) {
        this(apiKey, modelo, timeoutMs, API_BASE);
    }

    /** Para tests: apunta el cliente a un servidor local. */
    public ClienteGroq(String apiKey, String modelo, int timeoutMs, String apiBase) {
        this.apiKey = apiKey;
        this.modelo = modelo;
        this.restClient = RestClient.builder()
                .baseUrl(apiBase)
                .defaultHeaders(headers -> {
                    headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey);
                    headers.setContentType(MediaType.APPLICATION_JSON);
                })
                .build();
        if (disponible()) {
            log.info("ClienteGroq inicializado correctamente con modelo {}", modelo);
        } else {
            log.info("ClienteGroq inicializado sin API key (IA desactivada/fallback)");
        }
    }

    @Override
    public String nombre() {
        return "groq";
    }

    /** Si hay clave configurada, la IA puede usarse. */
    @Override
    public boolean disponible() {
        return apiKey != null && !apiKey.isBlank();
    }

    /**
     * Pide al modelo un objeto JSON. El prompt debe decirle que responda solo
     * JSON: se usa {@code response_format} para forzarlo y el contenido se
     * devuelve como árbol para que el llamador valide los campos.
     *
     * @return el JSON de la respuesta, o vacío si la llamada falla
     */
    @Override
    public Optional<JsonNode> completarJson(String instrucciones, String contenido) {
        if (!disponible()) {
            return Optional.empty();
        }
        try {
            var respuesta = restClient.post()
                    .uri("/chat/completions")
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
        } catch (Exception e) {
            // 429 del tier gratuito, timeout, red caida...: la IA no debe
            // tumbar una importacion que sin ella ya funcionaba.
            log.warn("Consulta a Groq falló: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private Optional<JsonNode> extraerContenido(Map<?, ?> cuerpo) {
        try {
            var json = MAPPER.readTree(MAPPER.writeValueAsString(cuerpo));
            JsonNode contenido = json.path("choices").path(0).path("message").path("content");
            if (contenido.isMissingNode() || contenido.isNull()) {
                return Optional.empty();
            }
            return Optional.of(MAPPER.readTree(contenido.asText()));
        } catch (Exception e) {
            log.warn("Respuesta de Groq ilegible: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private static final ObjectMapper MAPPER = new ObjectMapper();
}
