package com.novacrm.scraper.portal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.novacrm.vacante.Vacante;
import com.novacrm.vacante.VacanteRepository;
import org.jsoup.Jsoup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Conector con la API publica de empleo remoto de Remotive.
 *
 * <p>A diferencia del scraping de HTML, aqui hay una API documentada y de uso
 * permitido: {@code GET https://remotive.com/api/remote-jobs}. Sus condiciones
 * piden enlazar de vuelta y citar la fuente —por eso se guarda siempre
 * {@code urlOrigen}— y no consultarla mas de cuatro veces al dia, de ahi que
 * solo se invoque desde la tarea programada diaria.
 *
 * <p>Se filtran las ofertas por la region que admiten: una vacante "USA Only"
 * no le sirve a un participante en Colombia, y colarla solo ensucia el
 * matching.
 */
@Component
public class RemotiveConnector implements PortalScraper {

    private static final Logger log = LoggerFactory.getLogger(RemotiveConnector.class);
    private static final String PORTAL = "REMOTIVE";
    private static final String ENDPOINT = "https://remotive.com/api/remote-jobs";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** Tope por consulta: la API devuelve el tablero completo si no se limita. */
    private static final int LIMITE_POR_CONSULTA = 50;

    /**
     * Regiones desde las que un participante en Colombia puede trabajar. Se
     * comparan en minusculas contra {@code candidate_required_location}.
     */
    private static final List<String> REGIONES_ADMITIDAS = List.of(
            "worldwide", "anywhere", "global",
            "latam", "latin america", "south america", "americas",
            "colombia");

    private final VacanteRepository vacanteRepository;
    private final boolean habilitado;

    /**
     * Se crea en la primera consulta y no en el constructor: montar el cliente
     * abre recursos de red, y hacerlo al construir el bean acopla el arranque
     * de la aplicacion —y cualquier prueba que instancie esta clase— a que la
     * pila de red este disponible.
     */
    private volatile HttpClient httpClient;

    public RemotiveConnector(VacanteRepository vacanteRepository,
                             @Value("${app.scraping.remotive.enabled:true}") boolean habilitado) {
        this.vacanteRepository = vacanteRepository;
        this.habilitado = habilitado;
    }

    private HttpClient httpClient() {
        HttpClient actual = httpClient;
        if (actual == null) {
            synchronized (this) {
                actual = httpClient;
                if (actual == null) {
                    actual = HttpClient.newBuilder()
                            .connectTimeout(Duration.ofSeconds(15))
                            .followRedirects(HttpClient.Redirect.NORMAL)
                            .build();
                    httpClient = actual;
                }
            }
        }
        return actual;
    }

    @Override
    public List<Vacante> buscar(String keyword, String ubicacion) {
        if (!habilitado) {
            return List.of();
        }
        try {
            String url = ENDPOINT
                    + "?limit=" + LIMITE_POR_CONSULTA
                    + "&search=" + URLEncoder.encode(keyword == null ? "" : keyword.trim(),
                            StandardCharsets.UTF_8);

            HttpResponse<String> respuesta = httpClient().send(
                    HttpRequest.newBuilder(URI.create(url))
                            .header("Accept", "application/json")
                            .header("User-Agent", "NOVA-CRM/1.0 (empleabilidad CAC)")
                            .timeout(Duration.ofSeconds(20))
                            .GET()
                            .build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (respuesta.statusCode() != 200) {
                log.warn("Remotive respondio {} para '{}'", respuesta.statusCode(), keyword);
                return List.of();
            }
            return procesar(respuesta.body());

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Consulta a Remotive interrumpida");
            return List.of();
        } catch (Exception e) {
            log.error("Error consultando Remotive: {}", e.getMessage());
            return List.of();
        }
    }

    /** Convierte la respuesta y persiste lo que no estuviera ya guardado. */
    List<Vacante> procesar(String cuerpoJson) {
        List<Vacante> guardadas = new ArrayList<>();
        try {
            JsonNode ofertas = MAPPER.readTree(cuerpoJson).path("jobs");
            for (JsonNode oferta : ofertas) {
                try {
                    Optional<Vacante> vacante = mapear(oferta);
                    if (vacante.isEmpty()) {
                        continue;
                    }
                    if (vacanteRepository.findByHashDedup(vacante.get().getHashDedup()).isPresent()) {
                        continue;
                    }
                    guardadas.add(vacanteRepository.save(vacante.get()));
                } catch (Exception e) {
                    log.warn("Error mapeando oferta de Remotive: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Respuesta de Remotive ilegible: {}", e.getMessage());
        }
        return guardadas;
    }

    /**
     * Traduce una oferta al modelo propio.
     *
     * @return vacio si le falta lo imprescindible o si la region no admite a un
     *         candidato en Colombia
     */
    Optional<Vacante> mapear(JsonNode oferta) {
        String id = texto(oferta, "id");
        String titulo = texto(oferta, "title");
        if (id == null || titulo == null) {
            return Optional.empty();
        }

        String region = texto(oferta, "candidate_required_location");
        if (!admiteCandidatoEnColombia(region)) {
            return Optional.empty();
        }

        var vacante = new Vacante();
        vacante.setTitulo(titulo);
        vacante.setFuente(PORTAL);
        vacante.setHashDedup(sha256(PORTAL + "|" + id));
        vacante.setUbicacion(region == null ? "Remoto" : region);
        vacante.setModalidadTrabajo("REMOTO");
        vacante.setRangoSalarial(texto(oferta, "salary"));
        vacante.setTipoContrato(texto(oferta, "job_type"));

        // La descripcion viene en HTML; se guarda en texto plano porque
        // alimenta la comparacion de terminos del matching.
        String descripcionHtml = texto(oferta, "description");
        if (descripcionHtml != null) {
            vacante.setDescripcion(Jsoup.parse(descripcionHtml).text());
        }

        // Las condiciones de uso piden enlazar de vuelta a la oferta original.
        String url = texto(oferta, "url");
        vacante.setUrlOrigen(url);
        vacante.setUrlAplicar(url);

        vacante.setFechaPublicacion(fecha(texto(oferta, "publication_date")));
        vacante.setActivo(true);
        return Optional.of(vacante);
    }

    static boolean admiteCandidatoEnColombia(String region) {
        if (region == null || region.isBlank()) {
            // Sin restriccion declarada se asume abierta.
            return true;
        }
        String normalizada = region.toLowerCase(Locale.ROOT);
        return REGIONES_ADMITIDAS.stream().anyMatch(normalizada::contains);
    }

    private static LocalDateTime fecha(String valor) {
        if (valor == null) {
            return LocalDateTime.now();
        }
        try {
            return LocalDateTime.parse(valor.replace(" ", "T"));
        } catch (DateTimeParseException e) {
            try {
                return OffsetDateTime.parse(valor).toLocalDateTime();
            } catch (DateTimeParseException otra) {
                return LocalDateTime.now();
            }
        }
    }

    private static String texto(JsonNode nodo, String campo) {
        JsonNode valor = nodo.path(campo);
        if (valor.isMissingNode() || valor.isNull()) {
            return null;
        }
        String texto = valor.asText("").trim();
        return texto.isBlank() ? null : texto;
    }

    private static String sha256(String input) {
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of()
                    .formatHex(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    @Override
    public String getPortalNombre() {
        return PORTAL;
    }
}
