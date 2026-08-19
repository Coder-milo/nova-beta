package com.novacrm.scraper.portal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.scraper.fuente.AreaMetropolitana;
import com.novacrm.scraper.fuente.FuenteDeVacantes;
import com.novacrm.scraper.fuente.OfertaCruda;
import com.novacrm.scraper.fuente.ResultadoBusqueda;
import com.novacrm.scraper.fuente.Segmento;
import com.novacrm.vacante.Vacante;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

/**
 * Conector de vacantes para Jooble Colombia vía su API REST oficial.
 *
 * <p>Agrega ofertas consolidadas del departamento del Atlántico de empresas locales y
 * multinacionales. Requiere una clave gratuita en {@code app.scraping.jooble.api-key}
 * (obtenible en jooble.org/api).
 */
@Component
public class JoobleConnector implements FuenteDeVacantes {

    private static final Logger log = LoggerFactory.getLogger(JoobleConnector.class);
    private static final String PORTAL = "JOOBLE";
    private static final String API_BASE_URL = "https://jooble.org/api/";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final boolean habilitado;
    private final String apiKey;
    private final HttpClient httpClient;

    public JoobleConnector(@Value("${app.scraping.jooble.enabled:true}") boolean habilitado,
                           @Value("${app.scraping.jooble.api-key:}") String apiKey) {
        this.habilitado = habilitado;
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        if (habilitado && !this.apiKey.isBlank()) {
            log.info("Conector de Jooble Colombia ACTIVADO con API key.");
        } else if (habilitado) {
            log.info("Conector de Jooble Colombia en espera de JOOBLE_API_KEY.");
        }
    }

    @Override
    public String nombre() {
        return PORTAL;
    }

    @Override
    public Segmento segmento() {
        return Segmento.LOCAL_COLOMBIA;
    }

    @Override
    public boolean filtraPorCiudad() {
        return true;
    }

    @Override
    public boolean estaHabilitada() {
        return habilitado && !apiKey.isBlank();
    }

    @Override
    public int maximoConsultasPorCorrida() {
        return 6;
    }

    @Override
    public ResultadoBusqueda buscar(String termino, String ciudad) {
        if (!estaHabilitada()) {
            return ResultadoBusqueda.vacio();
        }
        if (termino == null || termino.isBlank()) {
            return ResultadoBusqueda.vacio();
        }

        List<OfertaCruda> resultados = new ArrayList<>();
        try {
            String ciudadBusqueda = (ciudad != null && !ciudad.isBlank()) ? ciudad : "Barranquilla";
            String requestBody = MAPPER.writeValueAsString(new JoobleRequest(termino, ciudadBusqueda, 1));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_BASE_URL + apiKey))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("Jooble API respondió status {}: {}", response.statusCode(), response.body());
                return ResultadoBusqueda.fallo("Jooble API respondió HTTP " + response.statusCode());
            }

            JsonNode root = MAPPER.readTree(response.body());
            JsonNode jobsNode = root.path("jobs");
            if (jobsNode.isArray()) {
                for (JsonNode job : jobsNode) {
                    OfertaCruda oferta = parsearJob(job, ciudadBusqueda);
                    if (oferta != null) {
                        resultados.add(oferta);
                    }
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResultadoBusqueda.fallo("Consulta a Jooble interrumpida");
        } catch (Exception e) {
            log.warn("Error consultando Jooble API para '{}' en '{}': {}", termino, ciudad, e.getMessage());
            return ResultadoBusqueda.fallo("Error consultando Jooble: " + e.getMessage());
        }

        return ResultadoBusqueda.de(resultados);
    }

    private OfertaCruda parsearJob(JsonNode node, String ciudadDefecto) {
        try {
            String id = node.path("id").asText("");
            String title = node.path("title").asText("").trim();
            String link = node.path("link").asText("").trim();
            if (title.isBlank() || link.isBlank()) {
                return null;
            }

            String company = node.path("company").asText("Empresa Confidencial").trim();
            String location = node.path("location").asText(ciudadDefecto).trim();
            String salary = node.path("salary").asText("").trim();
            String snippet = node.path("snippet").asText("").trim()
                    .replaceAll("<[^>]*>", ""); // Limpiar tags HTML

            String type = node.path("type").asText("").toLowerCase();
            String modality = "Presencial";
            if (type.contains("remot") || title.toLowerCase().contains("remot") || snippet.toLowerCase().contains("remot")) {
                modality = "Remoto";
            }

            Vacante vacante = new Vacante();
            vacante.setTitulo(title);
            vacante.setFuente(PORTAL);
            vacante.setHashDedup(sha256(PORTAL + "|" + (id.isBlank() ? link : id)));
            vacante.setUbicacion(location);
            vacante.setCiudad(extraerCiudad(location, ciudadDefecto));
            vacante.setRangoSalarial(salary.isBlank() ? null : salary);
            vacante.setDescripcion(snippet.isBlank() ? title + " en " + company : snippet);
            vacante.setUrlOrigen(link);
            vacante.setUrlAplicar(link);
            vacante.setModalidadTrabajo(modality);
            vacante.setJornada("Tiempo completo");
            vacante.setSegmento(modality.equals("Remoto") ? Segmento.REMOTO_INGLES : Segmento.LOCAL_COLOMBIA);
            vacante.setActivo(true);
            vacante.setFechaPublicacion(LocalDateTime.now());

            if (!AreaMetropolitana.esAtlanticoORemota(vacante)) {
                return null;
            }

            return new OfertaCruda(vacante, company);
        } catch (Exception e) {
            log.warn("Error parseando nodo de Jooble: {}", e.getMessage());
            return null;
        }
    }

    private static String extraerCiudad(String ubicacion, String ciudadDefecto) {
        if (ubicacion == null || ubicacion.isBlank()) return ciudadDefecto;
        String lower = ubicacion.toLowerCase();
        if (lower.contains("barranquilla")) return "Barranquilla";
        if (lower.contains("soledad")) return "Soledad";
        if (lower.contains("malambo")) return "Malambo";
        if (lower.contains("galapa")) return "Galapa";
        if (lower.contains("puerto colombia")) return "Puerto Colombia";
        if (lower.contains("sabanalarga")) return "Sabanalarga";
        if (lower.contains("atlantico") || lower.contains("atlántico")) return "Barranquilla";
        return ubicacion;
    }

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private record JoobleRequest(String keywords, String location, int page) {}
}
